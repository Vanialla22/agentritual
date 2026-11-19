-- Append-only by design. The API exposes NO endpoint that UPDATEs or
-- DELETEs rows in this table. Every admin decision (approve/reject) and
-- every voucher issuance is recorded here.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_submission
  ON audit_log (submission_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON audit_log (action);
