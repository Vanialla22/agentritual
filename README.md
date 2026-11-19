# AgentRitual — Agent-Native Social Quest & NFT Mint Platform

**Binance Agent ID Hackathon submission** (18 Nov – 9 Dec 2026, 15:00 WIB).
Total prizes 60,000 USDC. Innovation Award requires ≥ 30 unique Agent ID holder
addresses interacting with the contract during the submission period.

> **STATUS 19 Nov 2026 — MAINNET HOLD (free-first strategy).**
> The mainnet contract is deployed and owned by vanilla.ai, but there will be
> no public mint, no `setBaseURI` change, no BNB top-up, and no new mainnet
> transaction until real users exist. Testnet is the live demo environment.
> The repo is public on GitHub and the IPFS CAR backup is published as a
> GitHub Release — but that is a backup, not pinning: the metadata CIDs are
> still **not publicly pinned** (see below). Target additional development
> cost: **$0**.

## Problem & solution

AI agents are becoming the users of Web3, but there is no social ritual built
for them: quests are designed for humans clicking buttons, and "proof of
participation" is a screenshot. AgentRitual turns the flow around.

> Your Agent completes the quest. Your Agent ID proves eligibility.
> Your wallet authorizes the mint.

A user completes a social quest (Campaign 001) through **their own AI agent**
(Binance Agentic Wallet via BAW CLI, or Binance AI Pro), proves Agent ID
ownership on-chain, submits a Binance Square post URL as proof for **manual
admin review**, and — once approved — mints an ERC-721 NFT (max supply 1,000,
one per wallet) with a signed EIP-712 claim voucher. Every transaction
requires the user's explicit approval.

**What this project never does:**

- No wallet connect button, no QR-code login / pairing of any kind.
- No seed phrase, private key, API secret, or pairing code is ever requested
  or stored. (The backend never receives a user's private key.)
- No transaction is claimed to work before it is tested on-chain and verified
  on the explorer. Numbers shown as "not connected / no on-chain data yet"
  mean exactly that — mock numbers are never presented as real.
- No likes/follows are claimed to be auto-verified (there is no official API
  for that); the Square post is checked by a human admin.
- No volume, users, or engagement are fabricated. The tracker reads the chain.

## How it works (demo flow, testnet)

1. User holds a Binance Agent ID — on the testnet demo, a mock Agent ID from
   the mock registry. It proves the flow works, not that the holder owns a
   real Agent ID.
2. Their agent checks eligibility (`balanceOf` on the Agent ID registry).
3. User writes and publishes a Binance Square post manually.
4. User gives the post URL to their agent.
5. Agent submits it to the API (`POST /api/submissions`, with a wallet
   ownership proof signature).
6. Admin reviews it (approve → signed voucher; reject → note stored).
7. API issues a signed EIP-712 claim voucher (deadline ≤ 1 hour).
8. Agent prepares the mint; user explicitly authorizes the transaction.
9. NFT mints on-chain; the Live Mint Tracker shows the on-chain data.

## Architecture

See [docs/architecture.md](docs/architecture.md).

```
agentritual/
├── apps/web/          # Vite + React + TypeScript + Tailwind (6 pages, dark/gold)
├── apps/api/          # Node + TypeScript + Fastify (submissions, tracker, metadata, admin)
├── contracts/         # Foundry + OpenZeppelin (AgentRitualNFT, mock registry, scripts, tests)
├── packages/skill/    # Agent skill (skill.md — the copy-paste agent flow)
└── docs/              # architecture, admin rights, deployment, rate limits, runbooks
```

| Component | Status (19 Nov 2026) |
|---|---|
| Contract (testnet) | ✅ Deployed, Sourcify exact_match, totalSupply 7, all e2e flows proven |
| Contract (mainnet) | ✅ Deployed, Sourcify exact_match, owner = vanilla.ai, totalSupply 0, **HOLD** |
| API | ✅ Complete (Phase 4): admin auth, review, audit-log hash chain, ownership proof, rate limits, mint-audit |
| Web | ✅ Complete (6 pages, no mock numbers; tracker reads live testnet data) |
| Skill | ✅ Complete (`packages/skill/skill.md`) |
| IPFS metadata | ⚠️ CIDs final + CARs verified and backed up in the GitHub Release, **not publicly pinned yet** — a CAR in a Release is a backup, not a pin (see below). |
| Deployment (web/API/DB) | ❌ Not provisioned (manual step for the project owner). Plan: Vercel (web) + Render (API) + Turso (DB), all free tiers. The API does **not** run on Vercel — see [docs/deploy.md](docs/deploy.md). |
| GitHub repo | ✅ Public: [Vanialla22/agentritual](https://github.com/Vanialla22/agentritual) — pushed 19 Nov 2026 (`eb2aa44`). Release [`ipfs-artifacts-v1`](https://github.com/Vanialla22/agentritual/releases/tag/ipfs-artifacts-v1) published (CAR backup). |

## Contracts

### Testnet (BSC testnet, chain 97) — TESTNET

- **AgentRitualNFT:** `0xca998896041A761E315125cf42E8dBE8D3cE087C`
  ([BscScan](https://testnet.bscscan.com/address/0xca998896041A761E315125cf42E8dBE8D3cE087C))
  — deploy tx `0x8785386d58d9ef007807e4923ec0209a2eede9f5d3a366cd9c0986189fe95c48`,
  block 143.587.234, Sourcify exact_match. totalSupply 7 (tokens #0–#6).
- **MockAgentIdRegistry (test-only):** `0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7`
  — the real Agent ID contract does not exist on testnet; the mock has the
  same `balanceOf(address)` interface. Never for mainnet.
- Testnet voucher signer: `0x1EAE2306559725B54102D96a9333667a4292599b`
  (testnet-only key). baseURI: `https://agentritual.test/metadata/` (placeholder).

### Mainnet (BNB Chain, chain 56) — MAINNET HOLD

- **AgentRitualNFT:** `0x60153D5098EB900273164cb1f8623Fa91EC653B4`
  ([BscScan](https://bscscan.com/address/0x60153D5098EB900273164cb1f8623Fa91EC653B4))
  — deploy tx `0x704dcd77ed4d58051d3ec3d42fcb1eae79ada96ca9386db4d16a1d986931e26a`,
  block 134.475.521, gas 2.104.343 @ 0,05 gwei, Sourcify exact_match.
  Owner = `0xAA2790d9daA0b0BdAf748faB24aC34F315Dc0833` (vanilla.ai),
  authorizedSigner = `0x04C1cbAE1d7702CC789193ac016234F629A8bD8f`,
  registry = `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` (SPACE ID Agent ID),
  totalSupply 0, `NFT_DEPLOY_BLOCK = 134475521`.
  baseURI is still the placeholder `https://agentritual.xyz/metadata/` —
  the final IPFS baseURI is `ipfs://QmRmEpHAmBDRjmk4i4n9Tm6tQPYXpypmvz8SLVPs11Fy2Y/`
  and will only be set after pinning is verified (owner-only `setBaseURI`).

### Contract rules (both chains)

ERC-721 "AgentRitual Genesis Seal" (ARSEAL), OpenZeppelin v5.7.0
(ERC721, EIP712, Ownable2Step, Pausable, ReentrancyGuard). `mint` requires a
valid EIP-712 voucher from the authorized signer, `recipient == msg.sender`
(Agent ID owner == voucher recipient == minting wallet), `balanceOf > 0` on
the registry, unexpired + unused voucher, cap 1,000 per campaign, one NFT per
wallet per campaign. Owner can only `setAuthorizedSigner`, `setBaseURI`,
`pause`/`unpause` (+ 2-step ownership transfer). No admin mint, no cap raise.

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

## Run the tests

```bash
# Contracts: 27/27 pass (unit + fuzz + invariants + audit + ownership)
cd contracts && forge test

# API: TypeScript build must pass (no separate unit suite yet)
cd apps/api && npm run build

# Web: typecheck + production build must pass
cd apps/web && npm run build
```

All three were last run green on 19 Nov 2026 (forge 27/27 in ~3 s,
API `tsc` exit 0, web `vite build` exit 0).

## Deployment & environment

See [docs/deploy.md](docs/deploy.md). In short: frontend → Vercel (free),
API → Render (free web service, single instance), database → Turso (free
tier). The API does **not** run on Vercel — it is a long-running Fastify
server with no serverless adapter, and its in-memory rate limiter and audit
`seq` need a single instance (an earlier version of this doc said otherwise;
corrected 19 Nov 2026, Phase 0). **Provisioning Vercel/Render/Turso accounts
is a manual step for the project owner** — no account is created by this repo
or by any agent. Environment variables are documented in `.env.example`
(root), `apps/api/.env.example`, and `apps/web/.env.example` — placeholders
only, never commit a filled-in copy.

Mainnet API env (when deployed): `NFT_CHAIN_ID=56`,
`NFT_CONTRACT_ADDRESS=0x60153D5098EB900273164cb1f8623Fa91EC653B4`,
`NFT_DEPLOY_BLOCK=134475521`, `AGENT_ID_REGISTRY_ADDRESS=0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`,
`ADMIN_SIGNER_PRIVATE_KEY` (mainnet signer, via secure means only),
`ADMIN_PASSWORD_HASH` (owner-generated), `ADMIN_SESSION_SECRET`,
`ADMIN_WALLET` (**decision pending** — see "Admin rights" below; the earlier
recommendation of the deployer address was withdrawn in Phase 0),
`NFT_IMAGE_URL` (set after pinning).

## Binance Agentic Wallet limitations (honest)

- **BAW does not support BSC testnet (chain 97)** — testnet minting is done
  via `cast`/forge, not via the wallet. Mainnet contract calls via BAW CLI
  are proven (balance checks, ownership accept).
- **BAW sign-message is EIP-712 only** — it cannot personal-sign the API's
  wallet-ownership challenge; the agent must sign that itself (ethers/cast/
  AI Pro), or the user pastes a signature in the web UI.
- **BAW previews expire after ~5 minutes** — the "siap" handshake (user
  confirms holding the phone, then preview, then tap) is required.
- **Binance AI Pro is NOT YET TESTED** with this flow (test prompt in
  `docs/ai-pro-test-prompt.md`).
- **BAW sessions expire** (current session ends 20 Nov 2026 00:18 WIB);
  never assume a previous session is still active.
- No QR login, no Secure Auto Sign, no wallet-connect — by design and by
  hackathon rules.

## IPFS status — NOT PUBLICLY PINNED YET

Artwork: `contracts/metadata/genesis-seal.webp` (687.690 byte, 1600×1600,
sha256 `16712b0c…`). Metadata: 1.000 JSON files (`contracts/metadata/generated/`,
token 0–999), deterministic via `contracts/metadata/generate.py`.

Final CIDs (computed locally with kubo 0.36.0, deterministic):

- Image folder: `QmZyawewn8n2czXA1CiQjPj7zXXtxX7yG4KPTTKJnkAqht`
- Metadata folder: `QmRmEpHAmBDRjmk4i4n9Tm6tQPYXpypmvz8SLVPs11Fy2Y`
- Final baseURI: `ipfs://QmRmEpHAmBDRjmk4i4n9Tm6tQPYXpypmvz8SLVPs11Fy2Y/`

CAR exports (`image.car` 688.188 byte, `metadata.car` 671.878 byte) are kept
with the project working copy (`hidden_files/`, not in git) and published in
the GitHub Release
[`ipfs-artifacts-v1`](https://github.com/Vanialla22/agentritual/releases/tag/ipfs-artifacts-v1)
(19 Nov 2026). **Reproducing the CARs from git alone is proven**: plain
`ipfs add -r` (offline) on the committed files returns the exact same CIDs.
A CAR in a GitHub Release is a **backup, not a pin** — downloading it does
not make the CID resolvable on any public gateway. Metadata is NOT yet
available on any public gateway — do not claim otherwise. Pinning due
diligence so far: Storacha dead, Fil One not IPFS pinning, 4EVERLAND no-go
for current needs, Filebase Free unknown (500 pinned files; `dag/import`
documented; whether one CAR counts as 1 pin or 1.001 pins is unconfirmed
without a probe upload).

## Admin rights

See [docs/admin-rights.md](docs/admin-rights.md). Short version: an admin can
approve/reject submissions and sign vouchers. An admin **cannot** mint for
anyone, raise the 1,000 cap, bypass one-per-wallet, change tracker numbers
(the tracker reads the chain), or see any user's private key.
**Self-approval — read this carefully, because the earlier wording was
misleading.** The code blocks an *approve* when the submission's wallet
equals `ADMIN_WALLET` (rejecting your own is allowed). But the admin session
carries no wallet identity at all — the block only compares the *submitter's*
wallet against the configured string. The project has a single admin
(Vanilla), who submits from vanilla.ai, the only wallet holding a real Agent
ID. So:
- `ADMIN_WALLET = vanilla.ai` — the block genuinely works, but then nobody
  can approve the owner's own submission (there is no second admin). The
  first mint deadlocks.
- `ADMIN_WALLET = deployer address` — the block never fires for a real
  submission (the deployer holds no Agent ID and never submits). Self-approval
  stays possible, only recorded in the audit log. The earlier recommendation
  of the deployer was withdrawn in Phase 0 (it was validated against test
  submissions made *from* the deployer, a pattern that does not match
  production).
- The choice is **pending the owner's decision** — do not present either
  configuration as "self-approval is blocked" unless it is the vanilla.ai
  one. What is always true: every approval is recorded in the append-only
  audit log with the voucher digest.

## Residual security risks

| # | Risk | Status |
|---|------|--------|
| 1 | IPFS metadata not publicly pinned | **FAIL** — open gap; baseURI still placeholder |
| 2 | M-3: single-key voucher signer (sole mint authority) | **KNOWN** — mitigations: rotation runbook, pause, ≤1 h deadlines, mint-audit |
| 3 | Audit-log external checkpoint still manual | **KNOWN** — chain is tamper-evident, not tamper-proof, without an external checkpoint |
| 4 | Rate limiter in-memory (per-process) | **KNOWN** — needs a shared store for multi-instance |
| 5 | L-1: `revoked_sessions` rows never pruned | **OPEN** (Low) |
| 6 | L-2: `audit_log.seq` has no UNIQUE constraint | **OPEN** (Low; multi-instance collision risk) |
| 7 | Repo not on GitHub yet | ✅ **Done 19 Nov 2026** — repo public, pushed (`eb2aa44`), Release `ipfs-artifacts-v1` published |
| 8 | Vercel (web) / Render (API) / Turso (DB) not provisioned | **OPEN** — web + API not deployed |
| 9 | Admin password + `ADMIN_WALLET` not finalized | **OPEN** — owner's step; `ADMIN_WALLET` decision pending (see "Admin rights") |
| 10 | Binance AI Pro not tested | **NOT TESTED** |
| 11 | BAW session expiry | **KNOWN** — re-pair needed after expiry |

Full audit history: Phase 2 final audit (GO WITH FIXES, 0 Critical/High),
Phase 4 hardening review, independent diff review (SAFE conditional on M-1,
fixed), Ownable2Step glance (SAFE TO DEPLOY). Reports live with the project
working copy under `files/`.

## Costs

Target additional development cost: **$0**. Actual spend so far: ~0,000108 BNB
(~$0,06) for the mainnet deploy + ownership transfer. No paid service,
subscription, or credit card is used. Future costs are NOT approved: Filebase
Pro $7,50/mo, any gas for a future `setBaseURI` (~0,000002 BNB) or mint
(~0,0000073 BNB each) — all require the owner's separate approval.

## Growth milestone

Initial target: **100 successful NFT mints** (0–10 validate the product,
10–50 early adoption, 50–100 evaluate traction, 100 evaluate sponsor/grant/
funding opportunities). Metrics tracked from the first public mint: successful
mints, unique wallets, valid Agent IDs interacting, failed transactions,
returning users, actual cost per mint. No volume manipulation, no fake
wallets. 100 mints is not a funding guarantee.
