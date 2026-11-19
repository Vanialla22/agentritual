# Binance AI Pro — Live Test Script (AgentRitual)

> **Status: UNVALIDATED.** This script has NOT been run. It cannot be
> tested from the build VM: Binance AI Pro lives in the Binance App
> on the user's phone, and this environment has no access to it.
> Run the steps below on the phone and record the outcome before
> treating AI Pro as a supported path for AgentRitual.

## Goal

Prove, end to end, that a user can run the AgentRitual Campaign 001
quest through **Binance AI Pro** (no computer, no CLI): check Agent
ID ownership, draft the Square post, submit the proof URL, and mint
the Genesis Seal after approval — with preview + explicit
confirmation at every transaction.

## Prerequisites (on the phone)

1. Binance App installed and signed in.
2. An **Agentic Wallet** created in the app, with a **claimed Agent
   ID** (`.ai` name). The wallet holds a little BNB for gas.
3. **Developer Mode ON** in the Agentic Wallet (management page →
   Settings → Developer Mode). Custom contract calls need it.
4. Binance AI Pro accessible in the app (the AI chat entry point).
5. The AgentRitual skill text (`packages/skill/skill.md`) and the
   user prompt below, copied to the phone (or opened from the repo).

## User prompt (paste into AI Pro)

```
Join Campaign 001 on AgentRitual. Read the AgentRitual agent skill
(skill.md, published with the project repository) and follow it.

1. Check my Agentic Wallet address and confirm I hold a Binance
   Agent ID (balanceOf on the official Agent ID contract
   0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F must be greater than 0).
2. Draft an original Binance Square post for Campaign 001 with the
   hashtags #BinanceWalletHackathon and #AgenticWallet.
3. Show me the draft. I will publish it myself from my own Square
   account.
4. After I paste the post URL, submit it as proof for manual review.
5. If the proof is approved and a claim voucher is issued, show me
   the full mint transaction first — chain, contract address,
   recipient, NFT, and gas estimate — and wait for my explicit
   approval before executing anything.

Rules: never ask me for a seed phrase, private key, API secret, or
pairing code. Never enable Secure Auto Sign or skip the preview +
confirmation step. This website never shows a QR login — sign in
only through Binance AI Pro or a trusted agent of my own.
```

## Steps (record the result of EACH step)

### Step 1 — Agent ID check

- [ ] AI Pro shows the Agentic Wallet address.
- [ ] AI Pro calls `balanceOf` on the official Agent ID registry
      (`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, BSC mainnet 56)
      and reports the result.
- [ ] Result: balance is **1** (or more) → eligible.
- Notes / exact output: _____

### Step 2 — Square post draft

- [ ] AI Pro drafts an original post with both hashtags
      (`#BinanceWalletHackathon`, `#AgenticWallet`).
- [ ] The user publishes the post manually from their own Square
      account and copies the post URL.
- Notes: _____

### Step 3 — Proof submission

- [ ] The user pastes the post URL to AI Pro; AI Pro submits it to
      the AgentRitual API (`POST /api/submissions`) and reports the
      submission id + status `pending`.
- [ ] The user confirms the submission appears at
      `GET /api/submissions/<id>`.
- Notes: _____

### Step 4 — Approval + voucher (needs an admin approval first)

- [ ] An admin approves the submission (Phase 4 flow) and a voucher
      is issued.
- [ ] AI Pro fetches the submission and shows the voucher fields
      (`campaignId`, `recipient`, `deadline`, `nonce`, `signature`).
- Notes: _____

### Step 5 — Mint preview

- [ ] AI Pro shows the FULL mint transaction before executing:
      chain (56), contract (AgentRitualNFT address), recipient
      (user's wallet), NFT (Genesis Seal, Campaign 001), gas
      estimate, voucher deadline.
- [ ] A preview is shown with parsed transaction + risks, and AI Pro
      waits for explicit approval.
- [ ] The user approves explicitly.
- Notes / exact preview output: _____

### Step 6 — Mint + verify

- [ ] The mint executes; AI Pro returns a `txHash`.
- [ ] The receipt is verified on-chain (status success) and the
      BscScan link is shown.
- [ ] `ownerOf(tokenId)` is the user's wallet; `totalSupply()`
      increased by 1.
- Notes / txHash: _____

## What counts as PASS / FAIL

- **PASS:** all six steps complete with the recorded evidence above
  (screenshots or pasted outputs for steps 1, 5, 6 at minimum).
- **FAIL (record exactly):** any step where AI Pro cannot do the
  action (e.g. no contract-call support, no preview shown, asks for
  a seed phrase / API key / QR scan, or the flow silently skips
  confirmation). A FAIL on step 1 or 5 means AI Pro is NOT a
  supported path for AgentRitual and the skill must say so.

## Safety rules for the tester

- Never paste a seed phrase, private key, API secret, or pairing
  code into AI Pro or any chat.
- Never approve a transaction you have not read in full (chain,
  contract, recipient, NFT, gas).
- Never enable Secure Auto Sign. If AI Pro suggests it, stop the
  test and record it as a FAIL.
- Test on **mainnet only when the real NFT contract is deployed**
  (Phase 5). Before that, AI Pro can only run steps 1–3 against
  the live API; steps 4–6 need a deployed contract + an issued
  voucher. Do not mint on testnet through AI Pro: BAW-based
  tooling does not support chain 97 (verified in Phase 3), and AI
  Pro's testnet support is unknown until this script is run.
