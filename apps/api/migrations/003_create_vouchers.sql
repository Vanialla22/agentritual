CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  deadline INTEGER NOT NULL,
  nonce INTEGER NOT NULL,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (recipient, nonce)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_submission
  ON vouchers (submission_id);
