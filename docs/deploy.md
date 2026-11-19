# Deployment — AgentRitual

## Status: NOT provisioned

> **Update 19 Nov 2026:** the mainnet contract is DEPLOYED (see §5 checklist —
> steps 1–7 done, contract `0x60153D5098EB900273164cb1f8623Fa91EC653B4`,
> block 134.475.521, owner = vanilla.ai). **MAINNET HOLD (free-first strategy):**
> no new mainnet transactions — no public mint, no `setBaseURI`, no top-up —
> until real users exist. The checklist below remains the correct procedure
> record for the deploy that already happened and for any future step.
> The GitHub repo is public and pushed (`eb2aa44`); the IPFS CAR backup is
> published as Release `ipfs-artifacts-v1`. Vercel (web) / Render (API) /
> Turso (DB) provisioning is still pending and is a manual step for the
> project owner.

Nothing in this repo is deployed to any hosting service yet. Provisioning is
a **manual step for the project owner** — no agent creates accounts on the
owner's behalf.

## What to provision (when the owner decides)

### 1. GitHub repository (needed for the hackathon submission) — ✅ DONE 19 Nov 2026

- ~~Create a **public** repo `vanialla22/agentritual` on GitHub (owner's own
  account — the one linked to @vania-arb).~~ Done: repo is public at
  https://github.com/Vanialla22/agentritual.
- ~~Push this local directory (`~/workspace/agentritual-repo/`) to it.~~
  Done: pushed `cd73d9f..eb2aa44 main -> main` (no force); remote `main` =
  local HEAD `eb2aa44`, 1,099 files, license MIT.
- Release [`ipfs-artifacts-v1`](https://github.com/Vanialla22/agentritual/releases/tag/ipfs-artifacts-v1)
  published with `image.car`, `metadata.car`, `SHA256SUMS` (download-verified).
- Never push `.env` files or any real private key. `.gitignore` already
  excludes `.env`, `*.db`, `node_modules/`, and `dist/`.

### 2. Vercel — web app (not provisioned yet)

- Create a Vercel project with root directory = repo root (uses the
  repo-root `vercel.json`, which builds `@agentritual/web`). Do NOT also set
  root directory to `apps/web` — pick one; the `vercel.json` route is the
  one already in the repo.
- Set env var: `VITE_API_URL` = the deployed API URL (Render, §3).
  **Required** — the web app falls back to `http://localhost:3001` when it
  is unset, which breaks every API call from a visitor's browser.
- Framework: Vite. Build command: `npm run build --workspace=@agentritual/web`.
- Routing is hash-based (`#home`, `#campaign`, …), so no SPA fallback
  rewrites are needed.

### 3. Render — API (separate service, not Vercel)

> **Correction 19 Nov 2026 (Phase 0):** an earlier version of this doc said
> to deploy the API as a second Vercel project. That does not work. The API
> is a long-running Fastify server (`app.listen`, `node dist/index.js`) with
> no serverless adapter, and its in-memory rate limiter and audit-log `seq`
> assume a single process. Vercel Functions would run it as short-lived
> invocations with a fresh limiter and colliding `seq` values. The
> Vercel-API plan is **withdrawn**, not postponed. If the API ever moves to
> serverless, it needs an adapter (`@fastify/aws-lambda` or similar) AND a
> shared rate-limit store AND a UNIQUE constraint on `audit_log.seq` first.

- Create a **free web service** on Render from the repo (owner's own
  account), root directory `apps/api`.
- Build command: `npm install && npm run build`. Start command: `npm start`.
- Set `NODE_VERSION=22` (the API uses `node:sqlite`, built-in Node ≥ 22).
- `PORT` is injected by Render; the API already reads `process.env.PORT`.
- Set env vars (see `apps/api/.env.example`):
  `BSC_RPC_URL`, `NFT_CONTRACT_ADDRESS`, `NFT_CHAIN_ID`,
  `AGENT_ID_REGISTRY_ADDRESS`, `NFT_IMAGE_URL`, `NFT_DEPLOY_BLOCK`
  (the NFT contract's deployment block — required for a full mint-audit;
  see §5), `ADMIN_SIGNER_PRIVATE_KEY` (generate a fresh project key —
  never reuse a personal wallet key; store a backup offline, mode 600),
  `ADMIN_PASSWORD_HASH` (Phase 4), `ADMIN_SESSION_SECRET`,
  `AUTH_SECRET` (optional, defaults to the session secret),
  `ADMIN_WALLET` (decision pending — see README "Admin rights"),
  `AUTHORIZED_CAMPAIGNS`, `KNOWN_TEST_MINT_TX_HASHES`,
  `CORS_ORIGIN` (the web app URL — **required**, otherwise the browser
  blocks every API call), `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
  `DATABASE_PATH` (not used when Turso is set).
- The local SQLite file does **not** persist on Render — use Turso (§4)
  for any deployed API.
- Free-tier note: one always-on service fits in Render's 750 free
  instance-hours/month; free services sleep after 15 min idle (first
  request after sleep takes ~30–60 s). A free external keep-alive ping
  to `GET /api/health` every ~10 min is optional and tolerated.

### 4. Turso — database (free tier, not provisioned yet)

- Create a database at https://turso.tech (owner's own account).
- Set on the API service: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- When both are set, the API uses Turso instead of the local SQLite file.
- Run migrations against Turso once: `npm run migrate` with the Turso env
  vars set.
- Free tier (checked Nov 2026 — re-check turso.tech/pricing at
  provisioning): 100 databases, 5 GB storage, 500M rows read/month,
  10M rows written/month. This project needs 1 database and a few
  megabytes — far below every limit. No credit card required.

### 5. Contract (Phase 2 testnet, Phase 5 mainnet)

- Deploy scripts live in `contracts/script/`. Testnet:
  `Deploy.s.sol` (chain 97 only, deploys the mock registry). Mainnet:
  `DeployMainnet.s.sol` (chain 56 only, real registry hard-coded —
  see below).
- A deployment only counts as successful with a **transaction hash and
  BscScan source verification**. Mainnet deployment needs the owner's
  explicit approval and wallet tap, and only after Phase 5 tests pass.

#### Mainnet deploy checklist (Phase 5 — do in order)

1. **Contract is the Ownable2Step build.** Mainnet deploys
   `AgentRitualNFT` with two-step ownership (audit L-2, Phase 5
   prep): `transferOwnership` only sets a pending owner; the new
   owner must call `acceptOwnership()`. `forge test` must be 27/27
   (22 original + 5 ownership tests) before deploying.
2. **Registry is the real one — enforced by the script.**
   `contracts/script/DeployMainnet.s.sol` hard-codes the real Agent
   ID registry `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, requires
   chain 56, and requires `registry ==` that address (the testnet
   mock `0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7` is rejected by
   construction). Never deploy with the testnet script on mainnet.
3. **Metadata baseURI is the final IPFS URI.** Pin first (see
   `docs/metadata.md`): pin the artwork → `IMAGE_CID`, regenerate
   the 1,000 metadata files with that image URI, pin the folder →
   `METADATA_CID`, then deploy with
   `BASE_URI=ipfs://<METADATA_CID>/` (trailing slash). Do not change
   baseURI after launch (audit L-1 — no-change policy).
   **What actually happened:** pinning was not finished before the
   19 Nov deploy, so the contract was deployed with the placeholder
   `BASE_URI=https://agentritual.xyz/metadata/` and the final IPFS
   baseURI (`ipfs://QmRmEpHAmBDRjmk4i4n9Tm6tQPYXpypmvz8SLVPs11Fy2Y/`)
   is still pending — it can only be set later by the owner via
   `setBaseURI`, which is on MAINNET HOLD. The CIDs are final and the
   CARs are verified; public pinning is the open gap.
4. **Signer is a NEW mainnet key.** `MAINNET_SIGNER_ADDRESS` must be
   a fresh key generated for this project — never the testnet signer
   (`0x1EAE2306559725B54102D96a9333667a4292599b`). The API env
   `ADMIN_SIGNER_PRIVATE_KEY` is that key's private key: generate it
   offline, back it up offline (mode 600), never commit it, never
   paste it into chat. Rotation runbook: `docs/signer-rotation-runbook.md`.
5. **Dry-run first.** Simulate the deploy against a mainnet fork
   (no broadcast, no transaction):
   ```bash
   MAINNET_DEPLOYER_KEY=<key> MAINNET_SIGNER_ADDRESS=<addr> BASE_URI=ipfs://<METADATA_CID>/ \
     forge script contracts/script/DeployMainnet.s.sol --fork-url <bsc-rpc>
   ```
   (No `--broadcast` = simulation only. Note: forge 1.9.0 has no
   `--dry-run` flag; running without `--broadcast` IS the dry run.)
   The fork simulation at prep time estimated 2,677,526 gas
   (~0.000134 BNB at 0.05 gwei) — re-check at deploy time, see §6.
6. **Deploy (owner approval + wallet tap required).** — ✅ DONE 19 Nov 2026.
   Do NOT run this again — the contract is already deployed; a second
   deploy would create a second contract and confuse the submission.
   ```bash
   forge script contracts/script/DeployMainnet.s.sol --rpc-url <bsc-rpc> \
     --broadcast --verify --etherscan-api-key <key> -vv
   ```
   Recorded: contract `0x60153D5098EB900273164cb1f8623Fa91EC653B4`,
   tx `0x704dcd77ed4d58051d3ec3d42fcb1eae79ada96ca9386db4d16a1d986931e26a`,
   block 134.475.521, gas 2,104,343 @ 0.05 gwei = 0.00010521715 BNB,
   Sourcify exact_match. Ownership then transferred 2-step to vanilla.ai
   (tx `0x25e83fb87cd4c78777fd873aff0192f205f5aa3de472296f631e0f50ee1bf8b6`).
7. **Set `NFT_DEPLOY_BLOCK` on the API to the real mainnet deploy
   block immediately** (M-1). Without it, `GET /api/admin/mint-audit`
   scans only the trailing 5,000 blocks and answers
   `windowTruncated: true` — an incomplete scan must never be read
   as "no anomalies". Verify in the Admin page: the mint-audit
   section shows a "Full window" state when the block is set.
8. **API env for mainnet** (set on the Render API service when it is
   created — **not provisioned yet**, see `apps/api/.env.example`):
   - `NFT_CHAIN_ID=56`, `NFT_CONTRACT_ADDRESS=<mainnet address>`,
     `AGENT_ID_REGISTRY_ADDRESS=0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`
   - `NFT_DEPLOY_BLOCK=<mainnet deploy block>` (step 7)
   - `NFT_IMAGE_URL=ipfs://<IMAGE_CID>/genesis-seal.webp` (same image
     URI as the pinned metadata)
   - `AUTHORIZED_CAMPAIGNS=001` (default; only Campaign 001 accepts
     submissions/reviews/vouchers — an empty value disables ALL
     campaigns, fail-closed)
   - `ADMIN_SIGNER_PRIVATE_KEY=<new mainnet signer key>` (step 4)
   - `ADMIN_PASSWORD_HASH=` — generated by the OWNER with
     `ADMIN_PASSWORD='...' npm run admin:hash` (scrypt hash; never
     commit a real hash, never reuse the test password)
   - `ADMIN_SESSION_SECRET=` — fresh random 32+ bytes (HMAC-signs
     admin sessions, 2 h); `AUTH_SECRET` defaults to it
   - `ADMIN_WALLET=` — the admin's own wallet (enables the
     self-approval block)
   - `KNOWN_TEST_MINT_TX_HASHES=` — leave EMPTY on mainnet (the
     default covers testnet tokens #0–#2 only; any mainnet mint
     without a voucher must show as an anomaly, not known-test)
   - `CORS_ORIGIN=` — the deployed web app URL
9. **Post-deploy checks:**
   - `tokenURI(0)` resolves to the pinned metadata — **NOT VERIFIED**:
     baseURI is still the placeholder; this check only passes after
     pinning + `setBaseURI` (HOLD).
   - `owner()` is vanilla.ai — ✅ verified (was the deployer at deploy
     time, transferred 2-step on 19 Nov).
   - `agentIdRegistry()` is the real registry — ✅ verified
     (`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, "SPACE ID Agent ID").
   - mint-audit shows `windowTruncated: false` — **pending**: requires
     `NFT_DEPLOY_BLOCK=134475521` on the API, which is not deployed yet.
   - Run one end-to-end voucher mint on mainnet only after the owner's
     explicit go-ahead — **not done, HOLD**.

## 6. Gas-cost estimate method (mainnet deploy)

Do not trust a stale dollar figure — compute it at deploy time:

```
deploy cost (BNB) = deploy gasUsed × current mainnet gas price (gwei) ÷ 1e9
```

- **deploy gasUsed:** testnet actual for the NFT deploy was
  2,060,184 gas (receipt, block 143,587,234); the Phase 5 fork
  simulation of the Ownable2Step build estimated 2,677,526 gas.
  Use the LARGER number as the planning figure, then read the real
  `gasUsed` from the deploy receipt.
- **current mainnet gas price:** read it at deploy time from the
  BscScan gas tracker (or `cast gas-price --rpc-url <bsc-rpc>`).
  The prep-time fork simulation used 0.05 gwei → ~0.000134 BNB;
  at 1 gwei the same deploy is ~0.00268 BNB; at 5 gwei ~0.0134 BNB.
- **Buffer:** fund the deployer with at least 3× the estimate
  (deploy + source verification is one tx, but keep headroom for a
  retry). Each user's mint gas is paid by that user from their own
  wallet, not by the project.

## Local development

```bash
npm install
cp apps/api/.env.example apps/api/.env   # then fill in, never commit
npm run migrate                          # local SQLite file
npm run dev:api                          # http://localhost:3001
npm run dev:web                          # http://localhost:5173
```

## Costs

$0 for hosting (Vercel web + Render API + Turso DB, all free tiers).
Actual spend so far: ~0.000108 BNB (~$0.06) for the mainnet deploy +
ownership transfer. Contract deployment on mainnet: compute it at deploy
time with the method in §6 (planning figure 2,677,526 gas — the prep-time
fork simulation estimated ~0.000134 BNB at 0.05 gwei; at 1 gwei
~0.00268 BNB; actual deploy used 2,104,343 gas = 0.00010521715 BNB).
Each user's mint gas is paid by that user from their own wallet.
