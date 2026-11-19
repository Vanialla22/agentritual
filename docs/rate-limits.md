# API rate limits (Phase 4)

In-memory token buckets (`apps/api/src/rateLimit.ts`, no new
dependency). Exceeding a limit returns HTTP 429 with a `Retry-After`
header and a JSON error. Limits are per route key + identity
(IP or wallet). Env overrides exist for ops tuning and tests; the
defaults below are the documented limits.

| Route | Limit | Identity |
|---|---|---|
| `POST /api/submissions` | 5 / hour | per wallet |
| `POST /api/submissions` | 20 / hour | per IP |
| `POST /api/admin/login` | 5 / 15 min | per IP |
| `GET /api/eligibility` | 60 / min | per IP |
| `GET /api/auth/challenge` | 10 / min | per IP |

Env overrides (all optional, defaults = the table above):

- `RATE_LIMIT_SUBMISSIONS_PER_WALLET_HOUR` (default 5)
- `RATE_LIMIT_SUBMISSIONS_PER_IP_HOUR` (default 20)
- `RATE_LIMIT_LOGIN_PER_IP_15MIN` (default 5)
- `RATE_LIMIT_ELIGIBILITY_PER_IP_MIN` (default 60)
- `RATE_LIMIT_CHALLENGE_PER_IP_MIN` (default 10)

Notes:

- Buckets live in the API process memory. That is fine for the
  single-instance deployment; a multi-instance public launch would
  need a shared store (Redis) instead.
- The submission wallet limit is the anti-spam control for the review
  queue (backlog item 4): one actor cannot flood the queue from one
  wallet, and the IP limit caps floods across many wallets.
- The login limit is a brute-force guard for the admin password.
