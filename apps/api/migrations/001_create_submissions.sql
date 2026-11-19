CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  square_url TEXT NOT NULL,
  campaign_id TEXT NOT NULL DEFAULT '001',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_wallet_campaign
  ON submissions (wallet, campaign_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON submissions (status);
