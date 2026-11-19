# Genesis Seal metadata — IPFS plan (mainnet, Campaign 001)

**Status: NOT pinned.** Nothing here has been uploaded to IPFS by any
agent. Pinning is a **manual step for the project owner** (or an explicit
owner approval) — no agent creates an IPFS pinning-service account on
the owner's behalf, and no agent uploads anything.

## What the metadata is

- Template: `contracts/metadata/template.json` — one file per token,
  shape matches the API route `GET /metadata/:id`
  (`apps/api/src/routes/metadata.ts`): same keys (`name`,
  `description`, `image`, `external_url`, `attributes`, `note`) and
  the same values for Campaign 001. One intentional difference: the
  API's hardcoded `note` still says the artwork "ships with the
  contract (Phase 2)"; the pinned files carry the final note
  ("Final Genesis Seal metadata, pinned to IPFS for the mainnet
  launch (Campaign 001)"). Update the API note to match before the
  mainnet launch so the two sources agree.
- Generator: `contracts/metadata/generate.py` (Python 3, stdlib only,
  deterministic — re-running with the same `--image-uri` produces
  byte-identical files). It can produce all 1,000 files (token IDs
  0–999, Campaign 001); the first 10 (`generated/0` … `generated/9`)
  are already generated in this repo as a sample.
- Files are named by token ID with **no extension** — the contract's
  `tokenURI` is `baseURI + tokenId`, so the file named `42` must
  answer at `ipfs://<METADATA_CID>/42`.

## The artwork problem (read first)

There is **no final Genesis Seal artwork file in this repo yet**. The
prototype's `nft-seal.webp` was never committed, and the API route
returns `image: null` until `NFT_IMAGE_URL` is set. The metadata
references the artwork as:

```
ipfs://<IMAGE_CID>/genesis-seal.png
```

The exact art filename is the owner's choice (`genesis-seal.png` is
the placeholder name used here); whatever the final file is called,
the `image` URI in the metadata must point at the pinned file.

## Exact pinning steps (owner does or approves each step)

Pinning is **two steps**, in this order — the image must be pinned
FIRST, because the metadata files contain the image file's own CID:

### Step 1 — Pin the artwork

1. Take the final Genesis Seal artwork file (e.g.
   `genesis-seal.png`).
2. Upload / pin it to IPFS (Pinata, web3.storage, `ipfs add`, or any
   pinning service the owner already uses — the owner picks the
   service; no new account is created by an agent).
3. Record the returned CID as `IMAGE_CID`. The artwork URI is now:
   `ipfs://<IMAGE_CID>/genesis-seal.png`

### Step 2 — Regenerate + pin the metadata folder

1. Regenerate all 1,000 files with the real image URI (the current
   `generated/` files carry the placeholder `ipfs://<IMAGE_CID>/...`
   and MUST be regenerated before pinning):
   ```bash
   python3 contracts/metadata/generate.py \
     --image-uri ipfs://<IMAGE_CID>/genesis-seal.png \
     --out-dir contracts/metadata/generated
   ```
   Verify determinism: run it twice — the printed sha256 must match.
2. Pin the whole `contracts/metadata/generated/` folder to IPFS.
   Record the returned CID as `METADATA_CID`.
3. Sanity-check before deploying: fetch
   `https://ipfs.io/ipfs/<METADATA_CID>/0` (or any gateway) and
   confirm it returns the JSON for token #0 with the correct image
   URI, and fetch the image URI itself.

### Step 3 — Wire the CIDs into the deploy

- Deploy the contract with `BASE_URI=ipfs://<METADATA_CID>/`
  (trailing slash — `tokenURI(42)` becomes
  `ipfs://<METADATA_CID>/42`). See `contracts/script/DeployMainnet.s.sol`.
- Set the API env `NFT_IMAGE_URL=ipfs://<IMAGE_CID>/genesis-seal.png`
  so `GET /metadata/:id` serves the same image as the pinned files.
- **Do not change baseURI after launch** (audit L-1): the owner can
  rewrite all token metadata at any time via `setBaseURI`, so the
  no-change policy is: the IPFS baseURI set at deploy time is final.
  A `freezeBaseURI` function would require a redeploy — out of scope
  for this launch.

## What is already in this repo

| Path | What |
|---|---|
| `contracts/metadata/template.json` | Metadata template (API shape) |
| `contracts/metadata/generate.py` | Deterministic generator (0–999) |
| `contracts/metadata/generated/0` … `generated/9` | First 10 tokens, generated with the placeholder image URI — regenerate with the real `IMAGE_CID` before pinning |
