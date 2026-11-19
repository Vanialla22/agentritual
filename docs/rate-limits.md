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
- **Limitations of the in-memory limiter (hardening review H-4) —
  read before any public launch:**
  - **Lost on restart.** Every restart clears all buckets, so a
    burst that just tripped a limit gets a fresh allowance. Do not
    treat the limiter as a durable abuse record.
  - **Per-process only.** Two API instances do not share buckets —
    an attacker gets the full limit on EACH instance. A public
    multi-instance deployment MUST use a shared store (Redis) or a
    single instance behind the load balancer for these routes.
  - **No persistence.** There is no record of who was limited, or
    how often. Abuse investigation needs the request logs, not the
    limiter state.
  - **IP identity is the direct peer IP.** `req.ip` is the TCP peer
    unless Fastify `trustProxy` is enabled. Behind a reverse proxy
    without `trustProxy`, every client shares the proxy's IP and one
    bucket — the IP limits would throttle everyone at once. If the
    API runs behind a proxy, the operator must enable `trustProxy`
    in `server.ts` AND make sure the proxy strips client-supplied
    `X-Forwarded-For` headers (otherwise a client can spoof its IP
    and evade the limit). The default (no trustProxy) is correct
    for a directly-exposed API.
  - **Bucket memory is bounded by pruning.** Buckets idle for over
    an hour are dropped once the map exceeds 5,000 entries, so the
    map cannot grow without bound in a long-lived process.
- The submission wallet limit is the anti-spam control for the review
  queue (backlog item 4): one actor cannot flood the queue from one
  wallet, and the IP limit caps floods across many wallets.
- The login limit is a brute-force guard for the admin password.
