# Architecture — AgentRitual

Short summary. Full design: Phase 0 audit report §5 (in the working copy at
`~/workspace/goals/agentritual-binance-agent-id-hackathon/files/phase-0-audit.md`).

## Principles

1. The website **never** touches a wallet, a session, or a credential.
   On-chain actions happen only through the user's own AI agent (BAW CLI or
   Binance AI Pro) with preview + explicit user confirmation.
2. The backend does only three things: accept proof submissions, record admin
   reviews + audit log, and sign EIP-712 claim vouchers. It never executes a
   transaction on a user's behalf and never receives a user's private key.
3. The smart contract is the only enforcer of hard rules: 1,000 cap,
   one-per-wallet, single-use + expiring vouchers, three-address match,
   Agent ID gate.

## Components

| Component | Stack | Role | Status (19 Nov 2026) |
|---|---|---|---|
| `apps/web` | Vite + React + TypeScript + Tailwind | 6 pages (Home, Campaign 001, NFT Collection, Live Mint Tracker, Open Source, Admin). Reads data from the API. No wallet connect, no QR. | Built + tested (tsc + vite build green). **Not deployed.** |
| `apps/api` | Node + TypeScript + Fastify | `POST /api/submissions`, `GET /api/submissions/:id`, `GET /api/tracker`, `GET /metadata/:id`, admin auth + review (implemented in Phase 4). | Built + tested (Phase 4 e2e 25/25, hardening review, diff review). **Not deployed.** |
| Database | SQLite (local file) / Turso (cloud) | `submissions`, `audit_log` (append-only), `vouchers`, `_migrations`. | Migrations 001–005 tested on local SQLite. Turso **not provisioned**. |
| `contracts` | Foundry + OpenZeppelin (Phase 2) | `AgentRitualNFT` ERC-721 + EIP-712 voucher; mock Agent ID registry for testnet. | **Deployed** testnet (chain 97, totalSupply 7) + mainnet (chain 56, totalSupply 0, owner vanilla.ai). Sourcify exact_match both. Mainnet **HOLD**. |
| `packages/skill` | Markdown | Agent skill + prompt (full version Phase 3). | Complete. BAW testnet **not supported** (chain 97); AI Pro **not tested**. |

## Data flow

1. User's agent checks Agent ID ownership (`balanceOf` on the configured
   registry — the official `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` on
   BSC chain 56; the **mock** registry on the testnet demo, which proves
   the flow but not a real credential).
2. Agent drafts a Square post; the **user publishes it themselves**.
3. Proof URL is submitted to `POST /api/submissions` (stored as `pending`).
4. Admin manually reviews the post (Phase 4) → approve → backend signs a
   voucher `{campaignId, recipient, deadline, nonce}` (EIP-712).
5. Agent fetches the voucher, shows the user the full mint transaction
   (chain, contract, recipient, NFT, gas estimate), waits for explicit
   approval, then executes via BAW `contract-call preview` → `execute`.
6. The contract verifies the voucher, the Agent ID gate, expiry, replay,
   cap, and one-per-wallet, then mints and emits `Mint`.
7. The tracker reads `totalSupply` + `Mint` events from the chain.

## What is not yet proven (19 Nov 2026)

Honest list — nothing here is claimed to work before it is tested:

- **A user mint end-to-end via the user's own AI agent (BAW contract-call)
  has not happened.** Balance checks and the ownership-accept transaction
  are proven via BAW CLI on mainnet; a user mint via BAW is pending the
  first mainnet mint (HOLD, needs the owner's explicit go-ahead). Do not
  describe the flow as "the agent mints for you" as if it were already
  demonstrated.
- **Binance AI Pro is not tested** with this flow (test prompt in
  `docs/ai-pro-test-prompt.md`).
- **IPFS metadata is not publicly pinned.** The CIDs are final and the CARs
  are backed up in the GitHub Release, but no public gateway resolves them
  yet. `tokenURI(0)` still points at the placeholder baseURI.
- **No second admin exists.** The self-approval block compares the
  submission's wallet against `ADMIN_WALLET`; the admin session carries no
  wallet identity. `ADMIN_WALLET = deployer` leaves the block inert for
  real submissions; `ADMIN_WALLET = vanilla.ai` blocks self-approval but
  deadlocks the owner's own first mint. The choice is pending the owner's
  decision (see README "Admin rights").
- **Rate limiting and audit `seq` are single-instance only.** The API must
  run as one long-running process; a second instance or a serverless move
  needs a shared store and a UNIQUE constraint on `audit_log.seq` first.
- **The tracker shows the trailing 5,000 blocks of `Mint` events** for its
  recent-mints list (display window, not a full history). The mint-audit
  endpoint needs `NFT_DEPLOY_BLOCK` set to scan the full window.

## Hosting (free)

- Web: Vercel (Hobby, static Vite site — not provisioned yet).
- API: Render (free web service, single Node 22 instance — not provisioned
  yet). **Correction 19 Nov 2026:** the API does not run on Vercel — it is
  a long-running Fastify server with no serverless adapter, and its
  in-memory rate limiter + audit-log `seq` need one instance
  (see `docs/deploy.md` §3).
- Database: Turso free tier (SQLite-compatible, 1 database — not
  provisioned yet).
- Contract: BSC mainnet — deployed 19 Nov 2026 (Phase 5), owner
  vanilla.ai, **MAINNET HOLD** (no public mint, no `setBaseURI`, no
  top-up). Testnet contract also deployed (chain 97) for the demo.
