-- Phase 4: hash-chained audit log + review fields + vouchers nonce fix.
--
-- 1. audit_log gains prev_hash / entry_hash (hash chain, backlog item 2).
--    Rows written before Phase 4 get their chain computed by the JS
--    backfill in src/auditLog.ts at server startup.
ALTER TABLE audit_log ADD COLUMN prev_hash TEXT;
ALTER TABLE audit_log ADD COLUMN entry_hash TEXT;

-- 2. submissions gains review fields (admin reject note + review time).
ALTER TABLE submissions ADD COLUMN review_note TEXT;
ALTER TABLE submissions ADD COLUMN reviewed_at TEXT;

-- 3. vouchers.nonce was INTEGER in migration 003, but Phase 3 made the
--    nonce bytes32 (hex string). SQLite's INTEGER affinity stores a hex
--    string as TEXT anyway, but the schema was wrong — rebuild the table
--    with the correct type. Safe: no production DB exists yet.
CREATE TABLE IF NOT EXISTS vouchers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  deadline INTEGER NOT NULL,
  nonce TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (recipient, nonce)
);
INSERT OR IGNORE INTO vouchers_new (id, submission_id, recipient, deadline, nonce, signature, created_at)
  SELECT id, submission_id, recipient, deadline, CAST(nonce AS TEXT), signature, created_at FROM vouchers;
DROP TABLE vouchers;
ALTER TABLE vouchers_new RENAME TO vouchers;
CREATE INDEX IF NOT EXISTS idx_vouchers_submission
  ON vouchers (submission_id);
