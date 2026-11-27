import { Router, type Request, type Response, type NextFunction } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import type { AppConfig } from "../config/env";
import { completeReset, createResetToken, hashToken, issueSession, rotateSession, hashPassword, verifyPassword } from "../services/auth";
import { rateLimit } from "../services/rate-limit";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordValid = (value: unknown): value is string => typeof value === "string" && value.length >= 12 && value.length <= 128;
const emailValid = (value: unknown): value is string => typeof value === "string" && value.length <= 320 && emailPattern.test(value);
const tokenValid = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
const error = (response: Response, status: number, code: string, message: string) => response.status(status).json({ error: { code, message } });
type AuthRequest = Request & { auth?: { userId: string; roles: string[]; accessTokenHash: string } };

export function authMiddleware(database: PrismaClient) {
  return async (request: AuthRequest, response: Response, next: NextFunction) => {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.header("authorization") ?? "");
    if (!match) { error(response, 401, "UNAUTHORIZED", "Authentication required."); return; }
    try {
      const accessTokenHash = hashToken(match[1]);
      const session = await database.authSession.findUnique({
        where: { accessTokenHash }, include: { user: { include: { roleAssignments: { include: { role: true } } } } },
      });
      if (!session || session.revokedAt || session.accessExpiresAt <= new Date() || session.user.status !== "ACTIVE") {
        error(response, 401, "UNAUTHORIZED", "Authentication required."); return;
      }
      request.auth = { userId: session.userId, accessTokenHash, roles: session.user.roleAssignments.map((entry) => entry.role.code) };
      next();
    } catch (caught) { next(caught); }
  };
}

export function requireRole(...allowed: string[]) {
  return (request: AuthRequest, response: Response, next: NextFunction) => {
    if (!request.auth) { error(response, 401, "UNAUTHORIZED", "Authentication required."); return; }
    if (!request.auth.roles.some((role) => allowed.includes(role))) {
      error(response, 403, "FORBIDDEN", "Insufficient permissions."); return;
    }
    next();
  };
}

export function authRouter(database: PrismaClient, config: AppConfig) {
  const router = Router();
  const authenticate = authMiddleware(database);

  router.post("/signup", rateLimit("auth-signup", 10), async (request, response, next) => {
    try {
      const { email, password, ...extra } = request.body ?? {};
      if (Object.keys(extra).length || !emailValid(email) || !passwordValid(password)) {
        error(response, 400, "VALIDATION_ERROR", "Provide a valid email and a password of 12 to 128 characters."); return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const passwordHash = await hashPassword(password);
      const user = await database.user.create({ data: {
        email: normalizedEmail, passwordHash,
        learnerProfile: { create: {} },
        roleAssignments: { create: { role: { connect: { code: "LEARNER" } } } },
      } });
      response.status(201).json({ user: { id: user.id, email: user.email, roles: ["LEARNER"] } });
    } catch (caught) {
      if (typeof caught === "object" && caught !== null && "code" in caught && caught.code === "P2002") {
        error(response, 409, "EMAIL_IN_USE", "Email is already registered."); return;
      }
      next(caught);
    }
  });

  router.post("/login", rateLimit("auth-login", 20), async (request, response, next) => {
    try {
      const { email, password } = request.body ?? {};
      if (!emailValid(email) || typeof password !== "string" || password.length > 128) {
        error(response, 400, "VALIDATION_ERROR", "Provide email and password."); return;
      }
      const user = await database.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: { roleAssignments: { include: { role: true } } } });
      if (!user || user.status !== "ACTIVE" || !(await verifyPassword(password, user.passwordHash))) {
        error(response, 401, "INVALID_CREDENTIALS", "Invalid email or password."); return;
      }
      response.json({ user: { id: user.id, email: user.email, roles: user.roleAssignments.map((entry) => entry.role.code) }, tokens: await issueSession(database, user.id) });
    } catch (caught) { next(caught); }
  });

  router.post("/refresh", rateLimit("auth-refresh", 30), async (request, response, next) => {
    try {
      const token = request.body?.refreshToken;
      if (!tokenValid(token)) { error(response, 400, "VALIDATION_ERROR", "Provide a valid refresh token."); return; }
      const tokens = await rotateSession(database, token);
      if (!tokens) { error(response, 401, "INVALID_TOKEN", "Refresh token is invalid or expired."); return; }
      response.json({ tokens });
    } catch (caught) { next(caught); }
  });

  router.post("/logout", authenticate, async (request: AuthRequest, response, next) => {
    try {
      await database.authSession.updateMany({ where: { accessTokenHash: request.auth!.accessTokenHash }, data: { revokedAt: new Date() } });
      response.status(204).send();
    } catch (caught) { next(caught); }
  });

  router.get("/me", authenticate, (request: AuthRequest, response) => {
    response.json({ user: { id: request.auth!.userId, roles: request.auth!.roles } });
  });

  router.get("/admin-check", authenticate, requireRole("ADMIN"), (_request, response) => {
    response.json({ status: "ok" });
  });

  router.post("/password-reset/request", rateLimit("auth-reset-request", 5), async (request, response, next) => {
    try {
      if (!emailValid(request.body?.email)) { error(response, 400, "VALIDATION_ERROR", "Provide a valid email."); return; }
      if (config.nodeEnv === "production") { error(response, 503, "RESET_UNAVAILABLE", "Password reset is temporarily unavailable."); return; }
      const user = await database.user.findUnique({ where: { email: request.body.email.trim().toLowerCase() } });
      const resetToken = user?.status === "ACTIVE" ? await createResetToken(database, user.id) : undefined;
      response.json({ message: "If the account exists, a reset token has been issued.", ...(resetToken ? { resetToken } : {}) });
    } catch (caught) { next(caught); }
  });

  router.post("/password-reset/complete", rateLimit("auth-reset-complete", 10), async (request, response, next) => {
    try {
      if (!tokenValid(request.body?.token) || !passwordValid(request.body?.password)) {
        error(response, 400, "VALIDATION_ERROR", "Provide a valid token and password of 12 to 128 characters."); return;
      }
      if (!(await completeReset(database, request.body.token, request.body.password))) {
        error(response, 400, "INVALID_TOKEN", "Reset token is invalid or expired."); return;
      }
      response.json({ message: "Password reset complete. Sign in again." });
    } catch (caught) { next(caught); }
  });
  return router;
}
