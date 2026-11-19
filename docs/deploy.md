# Deployment — AgentRitual

## Status: NOT provisioned

> **Update 19 Nov 2026:** the mainnet contract is DEPLOYED (see §5 checklist —
> steps 1–7 done, contract `0x60153D5098EB900273164cb1f8623Fa91EC653B4`,
> block 134.475.521, owner = vanilla.ai). **MAINNET HOLD (free-first strategy):**
> no new mainnet transactions — no public mint, no `setBaseURI`, no top-up —
> until real users exist. The checklist below remains the correct procedure
> record for the deploy that already happened and for any future step.
> Vercel/Turso provisioning (step 8, API env) is still pending and is a manual
> step for the project owner.

Nothing in this repo is deployed anywhere. Provisioning is a **manual step
for the project owner** — no agent creates accounts on the owner's behalf.

## What to provision (when the owner decides)

### 1. GitHub repository (needed for the hackathon submission)

- Create a **public** repo `vanialla22/agentritual` on GitHub (owner's own
  account — the one linked to @vania-arb).
- Push this local directory (`~/workspace/agentritual-repo/`) to it.
- Never push `.env` files or any real private key. `.gitignore` already
  excludes `.env`, `*.db`, `node_modules/`, and `dist/`.

### 2. Vercel — web app

- Create a Vercel project with root directory `apps/web`
  (or use the repo-root `vercel.json`, which builds `@agentritual/web`).
- Set env var: `VITE_API_URL` = the deployed API URL.
- Framework: Vite. Build command: `npm run build --workspace=@agentritual/web`.

### 3. Vercel — API (separate project)

- Create a second Vercel project with root directory `apps/api`.
- Set env vars (see `apps/api/.env.example`):
  `PORT`, `DATABASE_PATH` (not used when Turso is set),
  `BSC_RPC_URL`, `NFT_CONTRACT_ADDRESS` (after Phase 2),
  `ADMIN_SIGNER_PRIVATE_KEY` (generate a fresh project key — never reuse a
  personal wallet key; store a backup offline, mode 600),
  `ADMIN_PASSWORD_HASH` (Phase 4), `CORS_ORIGIN` (the web app URL),
  `NFT_DEPLOY_BLOCK` (the NFT contract's deployment block — required for
  a full mint-audit; see §5).
- Note: on Vercel serverless, the local SQLite file does **not** persist —
  use Turso (below) for any deployed API.

### 4. Turso — database (free tier)

- Create a database at https://turso.tech (owner's own account).
- Set on the API project: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- When both are set, the API uses Turso instead of the local SQLite file.
- Run migrations against Turso once: `npm run migrate` with the Turso env
  vars set.

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
6. **Deploy (owner approval + wallet tap required).**
   ```bash
   forge script contracts/script/DeployMainnet.s.sol --rpc-url <bsc-rpc> \
     --broadcast --verify --etherscan-api-key <key> -vv
   ```
   Record the contract address AND the deployment block from BscScan.
7. **Set `NFT_DEPLOY_BLOCK` on the API to the real mainnet deploy
   block immediately** (M-1). Without it, `GET /api/admin/mint-audit`
   scans only the trailing 5,000 blocks and answers
   `windowTruncated: true` — an incomplete scan must never be read
   as "no anomalies". Verify in the Admin page: the mint-audit
   section shows a "Full window" state when the block is set.
8. **API env for mainnet** (set on the Vercel API project, see
   `apps/api/.env.example`):
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
9. **Post-deploy checks:** `tokenURI(0)` resolves to the pinned
   metadata; `owner()` is the deployer; `agentIdRegistry()` is the
   real registry; mint-audit shows `windowTruncated: false`; run one
   end-to-end voucher mint on mainnet only after the owner's explicit
   go-ahead.

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

$0 for hosting (Vercel + Turso free tiers). Contract deployment on
mainnet: compute it at deploy time with the method in §6 (planning
figure 2,677,526 gas — the prep-time fork simulation estimated
~0.000134 BNB at 0.05 gwei; at 1 gwei ~0.00268 BNB). Each user's mint
gas is paid by that user from their own wallet.
