import type { Request, Response, NextFunction } from "express";

export function rateLimit(scope: string, maximum: number, windowMs = 60 * 60 * 1000) {
  const windows = new Map<string, { count: number; expires: number }>();
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    if (windows.size >= 10000) {
      for (const [key, value] of windows) if (value.expires <= now) windows.delete(key);
      if (windows.size >= 10000) windows.delete(windows.keys().next().value!);
    }
    const key = `${scope}:${request.ip}`;
    const previous = windows.get(key);
    const entry = previous && previous.expires > now ? previous : { count: 0, expires: now + windowMs };
    entry.count += 1;
    windows.set(key, entry);
    if (entry.count > maximum) {
      response.setHeader("Retry-After", String(Math.ceil((entry.expires - now) / 1000)));
      response.status(429).json({ error: { code: "RATE_LIMITED", message: "Try again later." } });
      return;
    }
    next();
  };
}
