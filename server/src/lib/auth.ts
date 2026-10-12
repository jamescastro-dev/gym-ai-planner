import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, decodeJwt, errors, jwtVerify } from "jose";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VerifyToken = (token: string) => Promise<string>;

/**
 * Builds a verifier for Neon Auth access tokens (EdDSA JWTs, ~15 min lifetime).
 * Keys come from `<NEON_AUTH_URL>/.well-known/jwks.json` (cached and refreshed by jose).
 * The expected issuer is the origin of the auth URL unless `issuer` is given (NEON_AUTH_ISSUER).
 * Resolves with the user id (`sub`).
 */
export function createVerifier(authUrl: string, issuer?: string): VerifyToken {
  const base = authUrl.replace(/\/+$/, "");
  const expectedIssuer = issuer || new URL(base).origin;
  const jwks = createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));

  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: expectedIssuer,
      algorithms: ["EdDSA"],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== "string" || !UUID_RE.test(payload.sub)) {
      throw new Error("token subject is not a user id");
    }
    return payload.sub;
  };
}

let cached: { key: string; verify: VerifyToken } | null = null;

function getVerifier(): VerifyToken | null {
  const url = process.env.NEON_AUTH_URL;
  if (!url) return null;
  const issuer = process.env.NEON_AUTH_ISSUER || undefined;
  const key = `${url}|${issuer ?? ""}`;
  if (cached?.key !== key) cached = { key, verify: createVerifier(url, issuer) };
  return cached.verify;
}

/** The (unverified) iss/aud a rejected token claims. Public values, safe to log; the token itself is never logged. */
function describeClaims(token: string): string {
  try {
    const { iss, aud } = decodeJwt(token);
    return `claimed iss=${JSON.stringify(String(iss)).slice(0, 200)} aud=${JSON.stringify(aud ?? null).slice(0, 200)}`;
  } catch {
    return "token is not a decodable JWT";
  }
}

let loggedFirstSuccess = false;

/** Express middleware: requires a valid `Authorization: Bearer <jwt>`; sets `res.locals.userId`. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const verify = getVerifier();
  if (!verify) {
    console.error("[auth] NEON_AUTH_URL is not set; rejecting all authenticated requests");
    return res
      .status(500)
      .json({ error: "Server authentication is not configured.", code: "AUTH_NOT_CONFIGURED" });
  }

  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "")?.[1];
  if (!token) {
    return res.status(401).json({ error: "Please sign in to continue.", code: "UNAUTHENTICATED" });
  }

  try {
    const userId = await verify(token);
    res.locals.userId = userId;
    if (!loggedFirstSuccess) {
      loggedFirstSuccess = true;
      console.log(`[auth] first token verified OK (user ${userId.slice(0, 8)}…). Sign-in verification is working.`);
    }
    next();
  } catch (err) {
    if (err instanceof errors.JWKSTimeout) {
      console.error("[auth] timed out fetching Neon Auth keys");
      return res
        .status(503)
        .json({ error: "Sign-in service is slow to respond. Please try again.", code: "AUTH_UNAVAILABLE" });
    }
    console.warn(`[auth] token rejected: ${err instanceof Error ? err.message : err} (${describeClaims(token)})`);
    return res
      .status(401)
      .json({ error: "Your session has expired. Please sign in again.", code: "INVALID_TOKEN" });
  }
}

export function getUserId(res: Response): string {
  return res.locals.userId as string;
}
