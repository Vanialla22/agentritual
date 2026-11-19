import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { config } from "./config";
import type { Db } from "./db";

/**
 * Admin auth + wallet-ownership proof tokens (Phase 4).
 *
 * No new dependency: password hashing is Node stdlib scrypt, session and
 * proof tokens are HMAC-SHA256 over a base64url payload. Everything is
 * fail-closed when the required env secrets are unset.
 */

// ---------------------------------------------------------------------------
// Admin password hashing (scrypt, stdlib only)
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

/** Hash format: scrypt$N$r$p$<salt hex>$<derived-key hex> */
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    p: SCRYPT_P,
    r: SCRYPT_R,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Timing-safe password check against a stored scrypt hash. */
export function verifyAdminPassword(
  password: string,
  storedHash: string,
): boolean {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nStr, rStr, pStr, saltHex, keyHex] = parts;
    const key = scryptSync(password, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN, {
      N: Number(nStr),
      p: Number(pStr),
      r: Number(rStr),
    });
    const expected = Buffer.from(keyHex, "hex");
    return (
      key.length === expected.length && timingSafeEqual(key, expected)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// HMAC-signed tokens (admin sessions + ownership proofs)
// ---------------------------------------------------------------------------

function b64url(data: Buffer | string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface AdminSessionPayload {
  sub: "admin";
  iat: number;
  exp: number;
  /** Random id: two logins in the same second must not mint the same token. */
  jti: string;
}

export interface ProofTokenPayload {
  sub: "ownership-proof";
  address: string;
  iat: number;
  exp: number;
  /** Random id: two verifies in the same second must not mint the same token. */
  jti: string;
}

export const ADMIN_SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 h
export const PROOF_TOKEN_TTL_SECONDS = 10 * 60; // 10 min

function signToken(secret: string, payload: object): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

function verifyToken<T extends { exp: number }>(
  secret: string,
  token: string,
): T | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = createHmac("sha256", secret).update(body).digest();
    const given = b64urlDecode(sig);
    if (
      given.length !== expected.length ||
      !timingSafeEqual(given, expected)
    ) {
      return null;
    }
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as T;
    if (typeof payload.exp !== "number") return null;
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Create an admin session token (2 h). Null when no session secret. */
export function createAdminSession(): string | null {
  if (!config.adminSessionSecret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    exp: now + ADMIN_SESSION_TTL_SECONDS,
    iat: now,
    jti: randomBytes(16).toString("hex"),
    sub: "admin",
  };
  return signToken(config.adminSessionSecret, payload);
}

/** Verify an admin session token. Null when invalid/expired/unconfigured. */
export function verifyAdminSession(token: string): AdminSessionPayload | null {
  if (!config.adminSessionSecret) return null;
  const payload = verifyToken<AdminSessionPayload>(
    config.adminSessionSecret,
    token,
  );
  return payload && payload.sub === "admin" ? payload : null;
}

/** Create a wallet-ownership proof token (10 min, bound to one address). */
export function createProofToken(address: string): string | null {
  if (!config.authSecret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: ProofTokenPayload = {
    address: address.toLowerCase(),
    exp: now + PROOF_TOKEN_TTL_SECONDS,
    iat: now,
    jti: randomBytes(16).toString("hex"),
    sub: "ownership-proof",
  };
  return signToken(config.authSecret, payload);
}

/** Verify a proof token and that it belongs to `address`. */
export function verifyProofToken(
  token: string,
  address: string,
): ProofTokenPayload | null {
  if (!config.authSecret) return null;
  const payload = verifyToken<ProofTokenPayload>(config.authSecret, token);
  if (!payload || payload.sub !== "ownership-proof") return null;
  if (payload.address.toLowerCase() !== address.toLowerCase()) return null;
  return payload;
}

// ---------------------------------------------------------------------------
// Ownership challenge (stateless, HMAC-tagged)
// ---------------------------------------------------------------------------

export const CHALLENGE_TTL_SECONDS = 10 * 60; // 10 min

export interface Challenge {
  address: string;
  nonce: string;
  expiresAt: string;
  message: string;
}

export function buildChallenge(address: string): Challenge {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = new Date(
    Date.now() + CHALLENGE_TTL_SECONDS * 1000,
  ).toISOString();
  return {
    address: address.toLowerCase(),
    expiresAt,
    message: `AgentRitual ownership proof for ${address.toLowerCase()} — nonce ${nonce} — ${expiresAt}`,
    nonce,
  };
}

/** Parse a challenge message back into its fields. Null on bad shape. */
export function parseChallengeMessage(message: string): {
  address: string;
  nonce: string;
  expiresAt: string;
} | null {
  const m =
    /^AgentRitual ownership proof for (0x[0-9a-fA-F]{40}) — nonce ([0-9a-f]{32}) — (.+)$/.exec(
      message.trim(),
    );
  if (!m) return null;
  return { address: m[1].toLowerCase(), expiresAt: m[3], nonce: m[2] };
}

/**
 * Tag binding a challenge to the server secret, so a client cannot forge a
 * challenge (no DB table needed). The tag is returned with the challenge
 * and must be echoed back on verify.
 */
export function challengeTag(challenge: Challenge): string {
  if (!config.authSecret) return "";
  return createHmac("sha256", config.authSecret)
    .update(`${challenge.address}|${challenge.nonce}|${challenge.expiresAt}`)
    .digest("hex");
}

export function verifyChallengeTag(
  challenge: { address: string; nonce: string; expiresAt: string },
  tag: string,
): boolean {
  if (!config.authSecret || !tag) return false;
  const expected = createHmac("sha256", config.authSecret)
    .update(`${challenge.address}|${challenge.nonce}|${challenge.expiresAt}`)
    .digest();
  try {
    const given = Buffer.from(tag, "hex");
    return (
      given.length === expected.length &&
      timingSafeEqual(given, expected)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Single-use tracking + session revocation (Phase 4 hardening review)
// ---------------------------------------------------------------------------

/** SHA-256 of a token — what is stored, never the token itself. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Error && /UNIQUE constraint failed/i.test(err.message)
  );
}

/**
 * Mark a challenge nonce as used. Returns false when the nonce was
 * already consumed (replay) — the UNIQUE constraint on
 * used_challenges.nonce is the atomic guard, so two concurrent verifies
 * of the same challenge cannot both succeed. Any other DB error is
 * rethrown (never silently treated as "already used").
 */
export async function consumeChallenge(
  db: Db,
  nonce: string,
  address: string,
): Promise<boolean> {
  try {
    await db.run(
      "INSERT INTO used_challenges (nonce, address, used_at) VALUES (?, ?, ?)",
      [nonce, address.toLowerCase(), new Date().toISOString()],
    );
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

/**
 * Mark a proof token as used (exactly one successful submission per
 * token). Returns false when the token was already consumed. Call this
 * only after all other submission validation has passed, so a failed
 * submission (400/403/409/503) does not burn the token.
 */
export async function consumeProofToken(
  db: Db,
  token: string,
  address: string,
): Promise<boolean> {
  try {
    await db.run(
      "INSERT INTO used_proof_tokens (token_hash, address, used_at) VALUES (?, ?, ?)",
      [hashToken(token), address.toLowerCase(), new Date().toISOString()],
    );
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

/** True when the proof token was already consumed by a submission. */
export async function isProofTokenUsed(
  db: Db,
  token: string,
): Promise<boolean> {
  const row = await db.get<{ token_hash: string }>(
    "SELECT token_hash FROM used_proof_tokens WHERE token_hash = ?",
    [hashToken(token)],
  );
  return !!row;
}

/** Revoke an admin session token (logout). Idempotent. */
export async function revokeAdminSession(
  db: Db,
  token: string,
  expiresAt: number,
): Promise<void> {
  await db.run(
    "INSERT OR IGNORE INTO revoked_sessions (token_hash, revoked_at, expires_at) VALUES (?, ?, ?)",
    [hashToken(token), new Date().toISOString(), expiresAt],
  );
}

/** True when the admin session token was revoked via logout. */
export async function isAdminSessionRevoked(
  db: Db,
  token: string,
): Promise<boolean> {
  const row = await db.get<{ token_hash: string }>(
    "SELECT token_hash FROM revoked_sessions WHERE token_hash = ?",
    [hashToken(token)],
  );
  return !!row;
}
