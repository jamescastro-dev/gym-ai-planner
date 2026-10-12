import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Request, Response } from "express";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { createVerifier, requireAuth } from "./auth.js";

const KID = "test-key";
const USER_ID = "0b3f5a3e-6f7a-4c1e-9d5e-3f4f0a9a1c11";

let server: http.Server;
let authUrl: string;
let issuer: string;
let privateKey: CryptoKey;

before(async () => {
  const pair = await generateKeyPair("EdDSA", { extractable: true });
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: "EdDSA" };

  // A stand-in for Neon Auth's JWKS endpoint.
  server = http.createServer((req, res) => {
    if (req.url === "/neondb/auth/.well-known/jwks.json") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ keys: [jwk] }));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  issuer = `http://127.0.0.1:${port}`;
  authUrl = `${issuer}/neondb/auth`;
});

after(() => {
  server.close();
  delete process.env.NEON_AUTH_URL;
});

const sign = (opts: { sub?: string; iss?: string; exp?: string | number; key?: CryptoKey; kid?: string } = {}) =>
  new SignJWT({ email: "someone@example.com" })
    .setProtectedHeader({ alg: "EdDSA", kid: opts.kid ?? KID })
    .setSubject(opts.sub ?? USER_ID)
    .setIssuer(opts.iss ?? issuer)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "15m")
    .sign(opts.key ?? privateKey);

test("accepts a valid token and returns the user id", async () => {
  const verify = createVerifier(authUrl);
  assert.equal(await verify(await sign()), USER_ID);
});

test("rejects an expired token", async () => {
  const verify = createVerifier(authUrl);
  await assert.rejects(verify(await sign({ exp: Math.floor(Date.now() / 1000) - 60 })));
});

test("rejects a token from another issuer", async () => {
  const verify = createVerifier(authUrl);
  await assert.rejects(verify(await sign({ iss: "https://evil.example" })));
});

test("rejects a token signed with a different key (even with the right kid)", async () => {
  const verify = createVerifier(authUrl);
  const other = await generateKeyPair("EdDSA");
  await assert.rejects(verify(await sign({ key: other.privateKey })));
});

test("an explicit issuer override replaces the default (NEON_AUTH_ISSUER)", async () => {
  const custom = "https://auth.example.test/some/path";
  const verify = createVerifier(authUrl, custom);
  assert.equal(await verify(await sign({ iss: custom })), USER_ID);
  await assert.rejects(verify(await sign({ iss: issuer })), "the default origin is no longer accepted");
});

test("rejects a token whose subject is not a user id", async () => {
  const verify = createVerifier(authUrl);
  await assert.rejects(verify(await sign({ sub: "not-a-uuid" })), /not a user id/);
});

test("rejects unsigned (alg: none) and HMAC tokens", async () => {
  const verify = createVerifier(authUrl);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const payload = { sub: USER_ID, iss: issuer, exp: Math.floor(Date.now() / 1000) + 600 };
  await assert.rejects(verify(`${b64({ alg: "none" })}.${b64(payload)}.`));
  const hs = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", kid: KID })
    .sign(new TextEncoder().encode("shared-secret-shared-secret-shared"));
  await assert.rejects(verify(hs));
});

test("rejects garbage", async () => {
  const verify = createVerifier(authUrl);
  await assert.rejects(verify("not.a.jwt"));
});

// ── the Express middleware ──

function fakeRes() {
  const res = {
    locals: {} as Record<string, unknown>,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res;
}

async function run(authorization?: string) {
  process.env.NEON_AUTH_URL = authUrl;
  const res = fakeRes();
  let nextCalled = false;
  const req = { headers: { authorization } } as unknown as Request;
  await requireAuth(req, res as unknown as Response, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test("middleware: valid bearer token sets res.locals.userId and calls next", async () => {
  const { res, nextCalled } = await run(`Bearer ${await sign()}`);
  assert.equal(nextCalled, true);
  assert.equal(res.locals.userId, USER_ID);
});

test("middleware: missing header is 401 and never calls next", async () => {
  const { res, nextCalled } = await run(undefined);
  assert.equal(res.statusCode, 401);
  assert.equal((res.body as { code: string }).code, "UNAUTHENTICATED");
  assert.equal(nextCalled, false);
});

test("middleware: bad token is 401", async () => {
  const { res, nextCalled } = await run("Bearer not.a.jwt");
  assert.equal(res.statusCode, 401);
  assert.equal((res.body as { code: string }).code, "INVALID_TOKEN");
  assert.equal(nextCalled, false);
});

test("middleware: a rejected token logs its claimed issuer, never the token itself", async () => {
  const warn = mock.method(console, "warn", () => {});
  try {
    const bad = await sign({ iss: "https://wrong-issuer.example" });
    const { res } = await run(`Bearer ${bad}`);
    assert.equal(res.statusCode, 401);
    const logged = warn.mock.calls.map((c) => c.arguments.join(" ")).join("\n");
    assert.match(logged, /unexpected "iss" claim value/);
    assert.match(logged, /claimed iss="https:\/\/wrong-issuer\.example"/);
    assert.ok(!logged.includes(bad), "the raw token must not appear in logs");
    assert.ok(!logged.includes(bad.split(".")[2]), "nor its signature");
  } finally {
    warn.mock.restore();
  }
});

test("middleware: a client-supplied userId can't override the token's subject", async () => {
  process.env.NEON_AUTH_URL = authUrl;
  const res = fakeRes();
  const req = {
    headers: { authorization: `Bearer ${await sign()}` },
    body: { userId: "99999999-9999-4999-8999-999999999999" },
    query: { userId: "99999999-9999-4999-8999-999999999999" },
  } as unknown as Request;
  await requireAuth(req, res as unknown as Response, () => {});
  assert.equal(res.locals.userId, USER_ID);
});

test("middleware: fails closed when NEON_AUTH_URL is not configured", async () => {
  const res = fakeRes();
  delete process.env.NEON_AUTH_URL;
  let nextCalled = false;
  await requireAuth({ headers: { authorization: `Bearer ${await sign()}` } } as unknown as Request, res as unknown as Response, () => {
    nextCalled = true;
  });
  assert.equal(res.statusCode, 500);
  assert.equal(nextCalled, false);
});
