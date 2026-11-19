-- Phase 4 hardening review (migration 005).
--
-- 1. audit_log gains `seq` — an app-assigned, strictly increasing sequence
--    number (1, 2, 3, ...). verify() enforces seq[i] == seq[i-1] + 1, so a
--    row deletion or reorder that only fixes the hashes is still caught.
--    Rows written before this migration get their seq assigned by the JS
--    backfill in src/auditLog.ts at server startup (in id order).
ALTER TABLE audit_log ADD COLUMN seq INTEGER;

-- 2. Single-use ownership challenges: a challenge nonce may be verified
--    exactly once (hardening review finding H-1).
CREATE TABLE IF NOT EXISTS used_challenges (
  nonce TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  used_at TEXT NOT NULL
);

-- 3. Single-use proof tokens: a proof token may back exactly one
--    successful submission (hardening review finding H-1). Only the
--    SHA-256 hash of the token is stored, never the token itself.
CREATE TABLE IF NOT EXISTS used_proof_tokens (
  token_hash TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  used_at TEXT NOT NULL
);

-- 4. Revoked admin sessions (logout). The token itself is never stored —
--    only its SHA-256 hash, plus the expiry so old rows can be pruned.
CREATE TABLE IF NOT EXISTS revoked_sessions (
  token_hash TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires
  ON revoked_sessions (expires_at);
