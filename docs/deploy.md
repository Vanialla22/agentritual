# Deployment — AgentRitual

## Status: LIVE (testnet + mainnet APIs, web, both databases)

> **Update 20 Nov 2026:** both APIs and the web are live. Testnet API
> `https://agentritualapi-production.up.railway.app` (chain 97, supply 7) and
> mainnet API `https://agentritual-production.up.railway.app` (chain 56,
> supply 0) both answer `/api/health` 200. Web
> `https://agentritual.vercel.app` is live but still serves the pre-4.7
> build (single `VITE_API_URL`); the two-env switch (step 4.7) is pending.
> Mainnet baseURI was set to IPFS on 20 Nov 2026 (tx `0xa31e44cc…`, block
> 134.699.236). **Mainnet mint is NOT open:** minting via agent has never
> been tested end-to-end. Testnet remains the demo/testing chain.
> The GitHub repo is public and pushed; the IPFS CAR backup is published
> as Release `ipfs-artifacts-v1`.

Nothing in this repo is deployed by an agent. Provisioning is a **manual
step for the project owner** — no agent creates accounts on the owner's
behalf. This document is the runbook: it records what is live, how each
piece is configured, and what is still pending.

## What is live

| Piece | Where | Status |
|---|---|---|
| Web | Vercel — `https://agentritual.vercel.app` | Live, pre-4.7 build (single API env); two-env switch pending (§2) |
| API testnet | Railway service `@agentritual/api` (project `upbeat-emotion`) — `https://agentritualapi-production.up.railway.app` | Live, chain 97, supply 7 |
| API mainnet | Railway service `agentritual` (project `upbeat-emotion`) — `https://agentritual-production.up.railway.app` | Live, chain 56, supply 0 |
| DB testnet | Turso `agentritual` | Live |
| DB mainnet | Turso `agentritual-mainnet` (region ap-southeast-1) | Live |
| NFT testnet | `0xca998896041A761E315125cf42E8dBE8D3cE087C` (chain 97) | Deployed, Sourcify exact_match, BscScan verified |
| NFT mainnet | `0x60153D5098EB900273164cb1f8623Fa91EC653B4` (chain 56) | Deployed 19 Nov 2026, Sourcify exact_match, owner vanilla.ai |

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

### 2. Vercel — web app — ✅ LIVE (two-env switch pending, step 4.7)

- Vercel project with root directory = repo root (uses the repo-root
  `vercel.json`, which builds `@agentritual/web`). Do NOT also set
  root directory to `apps/web` — pick one; the `vercel.json` route is the
  one already in the repo.
- Framework: Vite. Build command: `npm run build --workspace=@agentritual/web`.
  Output directory: `apps/web/dist` (from `vercel.json`).
- Set env vars (see `apps/web/.env.example`):
  - `VITE_API_URL_TESTNET` = `https://agentritualapi-production.up.railway.app`
  - `VITE_API_URL_MAINNET` = `https://agentritual-production.up.railway.app`
  - **Both required.** The web app has no silent fallback: if the active
    mode's env is empty, that mode's button is disabled and API calls
    throw a clear error instead of quietly hitting the other network.
  - The old single `VITE_API_URL` was removed from the code (step 4.1).
    Setting it does nothing now; it can be removed from the Vercel
    project.
- Routing is hash-based (`#home`, `#campaign`, …), so no SPA fallback
  rewrites are needed.
- **Current state:** the live site still runs the pre-4.7 build (single
  testnet API). After the two envs are set and the site redeploys, the
  header shows the Testnet/Mainnet switch (default Testnet).

### 3. Railway — API (two services, same code, different config)

> **Correction 19 Nov 2026 (Phase 0):** an earlier version of this doc said
> to deploy the API as a second Vercel project. That does not work. The API
> is a long-running Fastify server (`app.listen`, `node dist/index.js`) with
> no serverless adapter, and its in-memory rate limiter and audit-log `seq`
> assume a single process. Vercel Functions would run it as short-lived
> invocations with a fresh limiter and colliding `seq` values. The
> Vercel-API plan is **withdrawn**, not postponed. If the API ever moves to
> serverless, it needs an adapter (`@fastify/aws-lambda` or similar) AND a
> shared rate-limit store AND a UNIQUE constraint on `audit_log.seq` first.

> **Correction 20 Nov 2026:** an earlier version of this doc said to deploy
> the API on Render. Render was never used — it requires a card for the
> free tier, and the project owner has no card. Both API services run on
> **Railway** instead (free trial, no card). Any remaining mention of
> Render in older notes is stale; Railway is the deployment target.

- Railway project `upbeat-emotion` (owner's own account, free trial:
  $5 credit for 30 days from 20 Nov 2026, no card — trial ends
  ~20 Dec 2026; services stop unless the trial is extended or upgraded).
- Two services from the same repo (`Vanialla22/agentritual`, branch
  `main`), root directory = repo root:
  - **Testnet:** service `@agentritual/api` —
    `https://agentritualapi-production.up.railway.app`
  - **Mainnet:** service `agentritual` —
    `https://agentritual-production.up.railway.app`
- Both services use the same commands:
  - Build: `npm run build --workspace=@agentritual/api`
  - Start: `npm run start --workspace=@agentritual/api`
  - Watch patterns: `/apps/api/**`
  - `PORT` is injected by Railway; the API already reads `process.env.PORT`.
  - `NODE_VERSION=22` (the API uses `node:sqlite`, built-in Node ≥ 22).
- **The two services run identical code with different env vars and
  different databases.** That is the whole difference — never copy one
  service's env into the other. The 20 Nov incident (mainnet env staged
  onto the testnet service, caught from a screenshot before applying)
  is the reason: **always check the service name + domain in the left
  card before editing env.** Testnet is `@agentritual/api`, mainnet is
  `agentritual` (no `/api`).
- Env vars: see the reference table in §5. `PORT` is not set manually.
- The local SQLite file does **not** persist on Railway — use Turso (§4)
  for any deployed API.
- Railway has no Render-style sleep: services stay up while the trial
  lasts. A free external keep-alive ping to `GET /api/health` every
  ~10 min is optional.

### 4. Turso — databases (free tier) — ✅ LIVE (both)

- Two **separate** databases — one per deployment, never shared:
  - Testnet: `agentritual`
  - Mainnet: `agentritual-mainnet` (region ap-southeast-1)
- Set on each API service: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
  (token: Read & Write, never expires; stored in the owner's password
  manager). When both are set, the API uses Turso instead of the local
  SQLite file.
- Run migrations against each Turso DB once: `npm run migrate` with that
  DB's env vars set (`apps/api` script `tsx src/scripts/migrate.ts`).
- Free tier (checked Nov 2026 — re-check turso.tech/pricing at
  provisioning): 100 databases, 5 GB storage, 500M rows read/month,
  10M rows written/month. This project needs 2 databases and a few
  megabytes — far below every limit. No credit card required.
- **Never point both deployments at one database.** The databases hold
  different submissions, vouchers, and audit logs per chain; sharing one
  would mix testnet demo data with mainnet records and break the
  mint-audit. A shared database needs a migration and testing first —
  do not do it casually.

## 5. Environment variable reference (verified against `apps/api/src/config.ts`)

Every variable below was checked against the actual code on 20 Nov 2026.
"Required" means the deployment does not work correctly without it;
"Default" is what the code uses when the variable is unset. **Never write
a real private key, password, token, or secret into this document, into
chat, or into the repo** — secrets live in the Railway dashboard (per
service) and in the owner's password manager.

| Variable | Required? | Default when unset | Testnet value | Mainnet value |
|---|---|---|---|---|
| `PORT` | No (Railway injects it) | `3001` | — (injected) | — (injected) |
| `DATABASE_PATH` | No (unused when Turso is set) | `./data/agentritual.db` | — | — |
| `TURSO_DATABASE_URL` | Yes in production | `""` (local SQLite) | DB `agentritual` | DB `agentritual-mainnet` |
| `TURSO_AUTH_TOKEN` | Yes in production | `""` | per-DB token | per-DB token (different DB, different token) |
| `BSC_RPC_URL` | Yes (set explicitly) | `https://bsc.publicnode.com` (mainnet!) | `https://bsc-testnet.publicnode.com` | `https://bsc.publicnode.com` |
| `NFT_CHAIN_ID` | Yes (set explicitly) | `97` | `97` | `56` |
| `NFT_CONTRACT_ADDRESS` | Yes | `""` (empty) | `0xca998896041A761E315125cf42E8dBE8D3cE087C` | `0x60153D5098EB900273164cb1f8623Fa91EC653B4` |
| `AGENT_ID_REGISTRY_ADDRESS` | Yes | `""` (eligibility fails closed, 503) | `0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7` (mock) | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` (official) |
| `NFT_IMAGE_URL` | Yes | `""` (metadata image is null) | `ipfs://QmZyawewn8n2czXA1CiQjPj7zXXtxX7yG4KPTTKJnkAqht/genesis-seal.webp` | same image URI (set 20 Nov 2026) |
| `NFT_DEPLOY_BLOCK` | Yes in production | `0` (trailing 5,000-block window) | `143587234` | `134475521` |
| `ADMIN_SIGNER_PRIVATE_KEY` | Yes (voucher signing) | `""` (signing disabled) | fresh testnet key (signer `0x1EAE2306559725B54102D96a9333667a4292599b`) | fresh mainnet key (signer `0xe78D134Bd58660332c40c3F2Afff3997914C2d6C`) |
| `ADMIN_PASSWORD_HASH` | Yes (admin login) | `""` (login returns 503) | scrypt hash, owner-generated | scrypt hash, owner-generated (different from testnet) |
| `ADMIN_SESSION_SECRET` | Yes | `""` (login returns 503) | fresh random 32+ bytes | fresh random 32+ bytes (MUST differ from testnet) |
| `AUTH_SECRET` | No (falls back to `ADMIN_SESSION_SECRET`) | `ADMIN_SESSION_SECRET` | same rule as session secret | same rule (MUST differ from testnet) |
| `ADMIN_WALLET` | Yes (self-approval block) | `""` (block inactive + startup warning) | `vanilla.ai` | `vanilla.ai` |
| `AUTHORIZED_CAMPAIGNS` | No | `001` | `001` | `001` |
| `AUTO_APPROVE` | No | `true` (auto-approve on; set `false` to restore manual review) | default (on) | default (on) |
| `MAX_VOUCHER_TTL_SECONDS` | No | `86400` (24 h voucher lifetime) | default (24 h) | default (24 h) |
| `KNOWN_TEST_MINT_TX_HASHES` | No | 3 testnet tx hashes (tokens #0–#2) | default (covers testnet test mints) | EMPTY (any mainnet mint without a voucher must show as an anomaly) |
| `CORS_ORIGIN` | Yes in production | `http://localhost:5173,http://localhost:3000` | `https://agentritual.vercel.app` | `https://agentritual.vercel.app` |
| `RATE_LIMIT_*` (5 vars) | No | documented Phase 4 limits (5/hr/wallet submissions, 20/hr/IP, 5/15min/IP logins, 60/min/IP eligibility, 10/min/IP challenges) | defaults | defaults |

Notes on the table:

- `BSC_RPC_URL` defaults to a **mainnet** RPC. The testnet service MUST
  override it, or the testnet API would read mainnet chain state. The
  testnet value above is confirmed by the live tracker (chain 97,
  supply 7 — a mainnet RPC would return supply 0).
- `NFT_CHAIN_ID` drives the EIP-712 voucher domain. A wrong value makes
  every voucher revert `InvalidSigner` on-chain (audit M-2). Testnet 97,
  mainnet 56 — never swap them.
- `ADMIN_SIGNER_PRIVATE_KEY` must be the key of the address the contract
  trusts as `authorizedSigner()`: testnet `0x1EAE…`, mainnet `0xe78D…`
  (rotated 20 Nov 2026, tx `0x9e9d4851…`). If the key and the on-chain
  signer disagree, every voucher fails. Generate fresh keys offline,
  back them up offline (mode 600), never commit them, never paste them
  into chat. Rotation runbook: `docs/signer-rotation-runbook.md`.
- `ADMIN_PASSWORD_HASH` is generated by the OWNER with
  `ADMIN_PASSWORD='...' npm run admin:hash` (script
  `apps/api/src/scripts/admin-hash.ts`; `ADMIN_PASSWORD` is only read by
  that script, never by the running API). Never commit a real hash, never
  reuse the test password.
- `AUTH_SECRET` defaults to `ADMIN_SESSION_SECRET`. The rule is not that
  the two must differ inside one deployment — it is that **each
  deployment's secrets must differ from the other deployment's**. Never
  copy testnet secrets into the mainnet service (or vice versa). A token
  signed for testnet must never validate on mainnet.
- `AUTHORIZED_CAMPAIGNS` is a comma-separated list (`"001,002"`); values
  are normalized to 3 digits. An explicitly empty value disables ALL
  campaigns (fail-closed).
- `NFT_DEPLOY_BLOCK` without a value makes `GET /api/admin/mint-audit`
  scan only the trailing 5,000 blocks and answer `windowTruncated:
  true` — an incomplete scan must never be read as "no anomalies".
  Verify in the Admin page: the mint-audit section shows a "Full
  window" state when the block is set. Mainnet `134475521` is confirmed
  set (stage-2 env table); testnet `143587234` must be confirmed the
  same way (see §10).
- Frontend env (web, `apps/web/.env.example`): only
  `VITE_API_URL_TESTNET` and `VITE_API_URL_MAINNET`. The old
  `VITE_API_URL` is gone from the code.

## 6. Network configuration

| | Testnet (demo) | Mainnet (live) |
|---|---|---|
| Chain ID | 97 (BSC testnet) | 56 (BSC mainnet) |
| NFT contract | `0xca998896041A761E315125cf42E8dBE8D3cE087C` | `0x60153D5098EB900273164cb1f8623Fa91EC653B4` |
| Agent ID registry | Mock `0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7` | Official `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |
| NFT deploy block | 143,587,234 | 134,475,521 |
| API | `https://agentritualapi-production.up.railway.app` | `https://agentritual-production.up.railway.app` |
| Turso DB | `agentritual` | `agentritual-mainnet` |
| Explorer | testnet.bscscan.com | bscscan.com |
| Authorized signer | `0x1EAE2306559725B54102D96a9333667a4292599b` | `0xe78D134Bd58660332c40c3F2Afff3997914C2d6C` |
| BaseURI | `https://agentritual.test/metadata/` (API placeholder) | `ipfs://QmRmEpHAmBDRjmk4i4n9Tm6tQPYXpypmvz8SLVPs11Fy2Y/` (set 20 Nov 2026) |
| Supply (20 Nov 2026) | 7 (demo mints) | 0 |
| Purpose | Demo + end-to-end testing | Live mint (not open yet) |

## 7. Security rules

- **Separate databases, separate secrets, per deployment.** Testnet and
  mainnet never share a Turso database, an `ADMIN_SESSION_SECRET`, an
  `AUTH_SECRET`, an `ADMIN_PASSWORD_HASH`, or an
  `ADMIN_SIGNER_PRIVATE_KEY`. Each deployment's values were generated
  independently.
- **The API signer must match `authorizedSigner()` on the contract.**
  Check before any promo: read `authorizedSigner()` on-chain and compare
  with the address derived from `ADMIN_SIGNER_PRIVATE_KEY`. A mismatch
  means every voucher reverts.
- **Never write a real secret into this repo, into chat, or into a
  screenshot.** Private keys, password hashes, session secrets, Turso
  tokens, and API keys live in the Railway dashboard and the owner's
  password manager only.
- **Never point both deployments at one database** without a migration
  and testing (§4).
- **Self-approval is blocked server-side** when `ADMIN_WALLET` is set
  (`admin.ts`: the review API returns 403 for the admin's own
  submission). Do not loosen this rule. Rejecting your own submission
  is allowed (it grants nothing).
- **Admin sessions** are HMAC-signed tokens, 2 h expiry, kept in memory
  only in the browser (never localStorage). A token from one deployment
  does not work on the other (different `ADMIN_SESSION_SECRET`).

## 8. Contract (Phase 2 testnet, Phase 5 mainnet)

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
   `BASE_URI=https://agentritual.xyz/metadata/`. The gap is now closed:
   image + 1,000 metadata files were pinned on Filebase and verified
   via gateway on 20 Nov 2026 (image folder CID
   `QmZyawewn8n2czXA1CiQjPj7zXXtxX7yG4KPTTKJnkAqht`, metadata CID
   `QmRmEpHAmBDRjmk4i4n9Tm6tQPYXpypmvz8SLVPs11Fy2Y`), and the owner
   set the final baseURI
   `ipfs://QmRmEpHAmBDRjmk4i4n9Tm6tQPYXpypmvz8SLVPs11Fy2Y/` via
   `setBaseURI` on 20 Nov 2026, tx
   `0xa31e44cc5b01dec580a953319385ac1f8fde59a760ddf57f18103f19a9996180`,
   block 134.699.236, gas 42,639 @ 0.13 gwei (≈ 0.0000056 BNB),
   first `BaseURISet` event on the mainnet contract.
4. **Signer is a NEW mainnet key.** `MAINNET_SIGNER_ADDRESS` must be
   a fresh key generated for this project — never the testnet signer
   (`0x1EAE2306559725B54102D96a9333667a4292599b`). The API env
   `ADMIN_SIGNER_PRIVATE_KEY` is that key's private key: generate it
   offline, back it up offline (mode 600), never commit it, never
   paste it into chat. Rotation runbook: `docs/signer-rotation-runbook.md`.
   **What actually happened:** the signer was rotated on 20 Nov 2026 —
   owner vanilla.ai called `setAuthorizedSigner(0xe78D134Bd58660332c40c3F2Afff3997914C2d6C)`,
   tx `0x9e9d4851a922b948a6a0080b79e061a76147f0353ce931e05c7d3c0dfc9d5dad`,
   block 134.669.990. The old signer key file on the agent VM was
   shredded; the current mainnet signer key exists only on the owner's
   PC (and as the Railway env value).
5. **Dry-run first.** Simulate the deploy against a mainnet fork
   (no broadcast, no transaction):
   ```bash
   MAINNET_DEPLOYER_KEY=<key> MAINNET_SIGNER_ADDRESS=<addr> BASE_URI=ipfs://<METADATA_CID>/ \
     forge script contracts/script/DeployMainnet.s.sol --fork-url <bsc-rpc>
   ```
   (No `--broadcast` = simulation only. Note: forge 1.9.0 has no
   `--dry-run` flag; running without `--broadcast` IS the dry run.)
   The fork simulation at prep time estimated 2,677,526 gas
   (~0.000134 BNB at 0.05 gwei) — re-check at deploy time, see §9.
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
   Mainnet value `134475521` (confirmed set); testnet value
   `143587234` (confirm the same way — see §10).
8. **API env for mainnet** (on the Railway service `agentritual` —
   **live since 20 Nov 2026**, see §5 for the full table):
   - `NFT_CHAIN_ID=56`, `NFT_CONTRACT_ADDRESS=<mainnet address>`,
     `AGENT_ID_REGISTRY_ADDRESS=0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`
   - `NFT_DEPLOY_BLOCK=134475521` (step 7)
   - `NFT_IMAGE_URL=ipfs://QmZyawewn8n2czXA1CiQjPj7zXXtxX7yG4KPTTKJnkAqht/genesis-seal.webp`
     (same image URI as the pinned metadata; set 20 Nov 2026)
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
     supply is 0, so no token exists to query yet. This is expected —
     it is NOT a placeholder problem anymore (baseURI is IPFS since
     20 Nov 2026). The check passes after the first mint.
   - `owner()` is vanilla.ai — ✅ verified (was the deployer at deploy
     time, transferred 2-step on 19 Nov).
   - `agentIdRegistry()` is the real registry — ✅ verified
     (`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, "SPACE ID Agent ID").
   - `authorizedSigner()` is `0xe78D134Bd58660332c40c3F2Afff3997914C2d6C`
     — ✅ verified (rotated 20 Nov 2026).
   - mint-audit shows `windowTruncated: false` — **pending**: requires
     `NFT_DEPLOY_BLOCK=134475521` on the API (confirmed set — verify in
     the Admin page).
   - Run one end-to-end voucher mint on mainnet only after the owner's
     explicit go-ahead — **not done; mint via agent untested, not open**.

## 9. Gas-cost estimate method (mainnet deploy)

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

## 10. Outstanding work (not hidden — tracked in order)

- **E2E testnet demo.** New test wallet (option b, on the owner's PC),
  1 Mock Agent ID + tBNB, full quest flow to token #8. Proves the
  voucher + mint path before anyone is invited.
- **Mint test via Binance Agentic Wallet (BAW).** The mint transaction
  has never been executed through BAW (contract calls that ARE proven
  via BAW: ownership accept, signer rotation, `setBaseURI`). Do not claim
  the agent mint path works until a BAW mint succeeds on testnet.
- **Voucher re-issue policy (blocker before mainnet promo).** A voucher
  lives 24 hours by default (env MAX_VOUCHER_TTL_SECONDS); if it expires, the submission cannot be re-reviewed
  (409) and cannot be re-submitted (409), and there is no re-issue
  endpoint. Decide the policy (and build the endpoint, if any) before
  promoting mainnet — otherwise an expired voucher locks a user out of
  the campaign permanently.
- **Post-deploy browser verification (step 4.7 checklist).** After the
  Vercel two-env deploy: tracker shows chain 97 / supply 7 on Testnet
  and chain 56 / supply 0 on Mainnet in a real browser; mode switch
  changes banner + footer + API; admin badge matches the deployment;
  faucet is testnet-only; voucher card appears only after approval.
- **Confirm `NFT_DEPLOY_BLOCK` on the testnet service** (expected
  `143587234`) via Admin → mint audit ("Full window" state).
- **Mainnet soft launch.** No public mint until: E2E testnet passes, a
  BAW mint succeeds, the voucher re-issue policy is decided, and the
  first mainnet mint is verified on-chain. The first mainnet mint
  cannot come from vanilla.ai (self-approval block) — it needs an
  approved submission from another Agent ID holder. Innovation Award
  needs ≥ 30 unique Agent ID addresses interacting with the mainnet
  contract during the submission window (18 Nov – 9 Dec 2026).

## Local development

```bash
npm install
cp apps/api/.env.example apps/api/.env   # then fill in, never commit
npm run migrate                          # local SQLite file
npm run dev:api                          # http://localhost:3001
npm run dev:web                          # http://localhost:5173
```

Local dev uses the testnet defaults (`NFT_CHAIN_ID=97`, local SQLite)
unless the env file overrides them. The web dev server needs
`apps/web/.env` with `VITE_API_URL_TESTNET=http://localhost:3001`
(or the testnet Railway URL); without it, the Testnet button is
disabled (fail-closed, no silent localhost fallback since step 4.1).

## Costs

$0 for hosting so far (Vercel web + Railway trial + Turso DB, all free
tiers; Railway trial $5 credit, 30 days from 20 Nov 2026 — no card).
Actual on-chain spend so far: ~0.000114 BNB total (mainnet deploy
0.00010521715 BNB + ownership transfer + `setBaseURI` ~0.0000056 BNB).
Contract deployment on mainnet: compute it at deploy time with the
method in §9 (planning figure 2,677,526 gas — the prep-time fork
simulation estimated ~0.000134 BNB at 0.05 gwei; at 1 gwei
~0.00268 BNB; actual deploy used 2,104,343 gas = 0.00010521715 BNB).
Each user's mint gas is paid by that user from their own wallet.
