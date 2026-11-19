# Deployment — AgentRitual

## Status: NOT provisioned (Phase 1)

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
  `ADMIN_PASSWORD_HASH` (Phase 4), `CORS_ORIGIN` (the web app URL).
- Note: on Vercel serverless, the local SQLite file does **not** persist —
  use Turso (below) for any deployed API.

### 4. Turso — database (free tier)

- Create a database at https://turso.tech (owner's own account).
- Set on the API project: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- When both are set, the API uses Turso instead of the local SQLite file.
- Run migrations against Turso once: `npm run migrate` with the Turso env
  vars set.

### 5. Contract (Phase 2 testnet, Phase 5 mainnet)

- Deploy scripts live in `contracts/script/` (Phase 2).
- A deployment only counts as successful with a **transaction hash and
  BscScan source verification**. Mainnet deployment needs the owner's
  explicit approval and wallet tap, and only after Phase 5 tests pass.

## Local development

```bash
npm install
cp apps/api/.env.example apps/api/.env   # then fill in, never commit
npm run migrate                          # local SQLite file
npm run dev:api                          # http://localhost:3001
npm run dev:web                          # http://localhost:5173
```

## Costs

$0 for hosting (Vercel + Turso free tiers). Contract deployment on mainnet
is ~$0.03–0.09 of BNB at current gas; each user's mint gas is paid by that
user from their own wallet.
