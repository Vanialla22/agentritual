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

| Component | Stack | Role |
|---|---|---|
| `apps/web` | Vite + React + TypeScript + Tailwind | 6 pages (Home, Campaign 001, NFT Collection, Live Mint Tracker, Open Source, Admin). Reads data from the API. No wallet connect, no QR. |
| `apps/api` | Node + TypeScript + Fastify | `POST /api/submissions`, `GET /api/submissions/:id`, `GET /api/tracker`, `GET /metadata/:id`, admin auth + review (implemented in Phase 4). |
| Database | SQLite (local file) / Turso (cloud) | `submissions`, `audit_log` (append-only), `vouchers`, `_migrations`. |
| `contracts` | Foundry + OpenZeppelin (Phase 2) | `AgentRitualNFT` ERC-721 + EIP-712 voucher; mock Agent ID registry for testnet. |
| `packages/skill` | Markdown | Agent skill + prompt (full version Phase 3). |

## Data flow

1. User's agent checks Agent ID ownership (`balanceOf` on the official
   registry `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, BSC chain 56).
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

## Hosting (free)

- Web + API: Vercel (two projects, see `docs/deploy.md`).
- Database: Turso free tier (SQLite-compatible).
- Contract: BSC mainnet (Phase 5 only, after tests pass).
