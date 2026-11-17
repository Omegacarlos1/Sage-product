import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PrismaClient } from "../generated/prisma/client";

const scrypt = promisify(scryptCallback);
const ACCESS_MS = 15 * 60_000;
const REFRESH_MS = 7 * 24 * 60 * 60_000;
const RESET_MS = 30 * 60_000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const candidate = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export async function issueSession(database: PrismaClient, userId: string) {
  const accessToken = newToken();
  const refreshToken = newToken();
  const now = Date.now();
  await database.authSession.create({ data: {
    userId, accessTokenHash: hashToken(accessToken), refreshTokenHash: hashToken(refreshToken),
    accessExpiresAt: new Date(now + ACCESS_MS), refreshExpiresAt: new Date(now + REFRESH_MS),
  } });
  return { accessToken, refreshToken, tokenType: "Bearer", expiresIn: ACCESS_MS / 1000 };
}

export async function rotateSession(database: PrismaClient, refreshToken: string) {
  const oldHash = hashToken(refreshToken);
  const accessToken = newToken();
  const nextRefreshToken = newToken();
  const now = new Date();
  const updated = await database.authSession.updateMany({
    where: { refreshTokenHash: oldHash, revokedAt: null, refreshExpiresAt: { gt: now }, user: { status: "ACTIVE" } },
    data: {
      accessTokenHash: hashToken(accessToken), refreshTokenHash: hashToken(nextRefreshToken),
      accessExpiresAt: new Date(now.getTime() + ACCESS_MS), refreshExpiresAt: new Date(now.getTime() + REFRESH_MS),
    },
  });
  if (updated.count !== 1) return null;
  return { accessToken, refreshToken: nextRefreshToken, tokenType: "Bearer", expiresIn: ACCESS_MS / 1000 };
}

export async function createResetToken(database: PrismaClient, userId: string) {
  const token = newToken();
  await database.passwordResetToken.create({ data: {
    userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_MS),
  } });
  return token;
}

export async function completeReset(database: PrismaClient, token: string, password: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(password);
  return database.$transaction(async (tx) => {
    const result = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() },
    });
    if (result.count !== 1) return false;
    const record = await tx.passwordResetToken.findUniqueOrThrow({ where: { tokenHash } });
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.authSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } });
    return true;
  });
}
