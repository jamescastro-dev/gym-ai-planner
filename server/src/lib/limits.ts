import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Plans one user may create per rolling 24h (checked against the database, so it survives restarts). */
export const USER_DAILY_PLAN_LIMIT = Number(process.env.PLANS_PER_USER_PER_DAY) || 3;

/** Per-IP cap on generation requests per day. In-memory: resets if the server restarts. */
export const generateIpLimiter = rateLimit({
  windowMs: DAY_MS,
  limit: Number(process.env.GENERATE_REQUESTS_PER_IP_PER_DAY) || 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many plan requests from your network today. Try again tomorrow, or view a sample plan.",
      code: "RATE_LIMITED",
    });
  },
});

/** Meal plans one user may create per rolling 24h. In-memory (no table for meal plans): resets if the server restarts. */
export const USER_DAILY_MEAL_LIMIT = Number(process.env.MEAL_PLANS_PER_USER_PER_DAY) || 2;

/** Per-IP cap on meal-plan requests per day. In-memory, separate from the plan limiter. */
export const mealIpLimiter = rateLimit({
  windowMs: DAY_MS,
  limit: Number(process.env.MEAL_REQUESTS_PER_IP_PER_DAY) || 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many meal-plan requests from your network today. Try again tomorrow.",
      code: "RATE_LIMITED",
    });
  },
});

/** Rolling 24h counter per key, in memory. */
export class DailyCounter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly now: () => number = Date.now) {}

  count(key: string): number {
    const since = this.now() - DAY_MS;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (recent.length) this.hits.set(key, recent);
    else this.hits.delete(key);
    return recent.length;
  }

  add(key: string) {
    this.hits.set(key, [...(this.hits.get(key) ?? []), this.now()]);
  }
}

let proxyLogged = false;

/**
 * Logs how the client IP was resolved, once per process. After deploying, check the log: `req.ip` should
 * be a visitor's address, not your host's proxy. If not, adjust TRUST_PROXY_HOPS.
 */
export function logProxyOnce(req: Request, _res: Response, next: NextFunction) {
  if (!proxyLogged) {
    proxyLogged = true;
    console.log(
      `[proxy-check] req.ip=${req.ip} x-forwarded-for="${req.headers["x-forwarded-for"] ?? ""}" trust-proxy-hops=${process.env.TRUST_PROXY_HOPS ?? "1"}`,
    );
  }
  next();
}
