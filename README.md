# AgentRitual — Agent-Native Social Quest & NFT Mint Platform

**Binance Agent ID Hackathon submission** (18 Nov – 9 Dec 2026, 15:00 WIB).
Total prizes 60,000 USDC. Innovation Award requires ≥ 30 unique Agent ID holder
addresses interacting with the contract during the submission period.

## Concept

> Your Agent completes the quest. Your Agent ID proves eligibility.
> Your wallet authorizes the mint.

A user completes a social quest (Campaign 001) through **their own AI agent**
(Binance Agentic Wallet via BAW CLI or Binance AI Pro), proves Agent ID
ownership on-chain, submits a Binance Square post URL as proof for **manual
admin review**, and — once approved — mints an ERC-721 NFT (max supply 1,000,
one per wallet) with a signed EIP-712 claim voucher. Every transaction
requires the user's explicit approval.

**What this website never does:**

- No wallet connect button, no QR-code login / pairing of any kind.
- No seed phrase, private key, API secret, or pairing code is ever requested
  or stored. (The backend never receives a user's private key.)
- No transaction is claimed to work before it is tested on-chain and verified
  on the explorer. Numbers shown as "not connected / no on-chain data yet"
  mean exactly that — mock numbers are never presented as real.

## Architecture

See [docs/architecture.md](docs/architecture.md) and the Phase 0 audit report
(`~/workspace/goals/agentritual-binance-agent-id-hackathon/files/phase-0-audit.md`
in the working copy; the report is also summarized in `docs/`).

```
agentritual/
├── apps/web/          # Vite + React + TypeScript + Tailwind (6 pages, dark/gold)
├── apps/api/          # Node + TypeScript + Fastify (submissions, tracker, metadata, admin*)
├── contracts/         # Foundry skeleton (full contract is Phase 2)
├── packages/skill/    # Agent skill draft (full skill is Phase 3)
└── docs/              # architecture, admin rights, deployment
```

\* Admin login/review endpoints are **stubs returning 501** in Phase 1.
They are implemented in Phase 4.

## Run locally

Prerequisites: Node ≥ 22, npm. (Foundry only needed for `contracts/`.)

```bash
# 1. Install all workspaces
npm install

# 2. Configure the API (copy and fill — never commit real secrets)
cp apps/api/.env.example apps/api/.env

# 3. Apply database migrations (local SQLite file)
npm run migrate

# 4. Start the API (http://localhost:3001)
npm run dev:api

# 5. Start the web app (http://localhost:5173)
npm run dev:web
```

The web app reads the API base URL from `VITE_API_URL`
(default `http://localhost:3001`).

## Deployment notes

See [docs/deploy.md](docs/deploy.md). In short: frontend + API deploy to
Vercel (free), database is Turso (free tier). **Provisioning Vercel/Turso
accounts is a manual step for the project owner** — no account is created by
this repo or by any agent. The NFT contract is **not deployed yet**; deployment
is Phase 2 (testnet) and Phase 5 (mainnet, only after end-to-end tests pass),
and a deployment only counts as successful with a transaction hash + explorer
verification.

## Admin rights

See [docs/admin-rights.md](docs/admin-rights.md). Short version: an admin can
approve/reject submissions and sign vouchers. An admin **cannot** mint for
anyone, raise the 1,000 cap, bypass one-per-wallet, change tracker numbers
(the tracker reads the chain), or see any user's private key.

## Status

**Phase 1 — Foundation (in progress).** Scaffolding only: web + API + DB +
contract skeleton + skill draft. No deployment, no keys, no mainnet.
