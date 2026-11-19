# AgentRitual Agent Skill — DRAFT (Phase 1)

> **Status: DRAFT.** The full skill — with the deployed contract address,
> ABI, and tested end-to-end flow — ships in **Phase 3**. Do not use this
> draft to execute a real mint: the contract is not deployed yet.

## What this skill is for

AgentRitual is an agent-native social quest and NFT mint platform. The user
asks their own AI agent (Binance Agentic Wallet via BAW CLI, or Binance AI
Pro) to join Campaign 001: prove Agent ID ownership, draft a Binance Square
post, submit the post URL for manual review, and — once a claim voucher is
issued — mint the Genesis Seal NFT.

## Hard rules (never break these)

1. **Preview first, always.** Before any transaction, run
   `contract-call preview`, show the user the parsed transaction and the risk
   details, and wait for their explicit confirmation. Execute only with the
   `requestId` from a successful preview.
2. **Never ask for a seed phrase, private key, API secret, or pairing code.**
   Not for the wallet, not for Square, not for anything.
3. **Never instruct the user to enable Secure Auto Sign** or to skip a
   confirmation step.
4. **The website never shows a QR login.** Sign-in to the Agentic Wallet
   happens only through Binance AI Pro or a trusted agent of the user's own.
   If the user is asked to scan a QR on a third-party website, stop and warn
   them.
5. **Three addresses must match.** The Agent ID owner wallet, the voucher
   recipient, and the minting wallet must be the same address. If they
   differ, stop and tell the user.
6. **No claim without evidence.** Never tell the user a mint succeeded until
   the transaction receipt is verified on-chain and the explorer link is
   shown.

## Flow (Phase 3 — to be completed with the real contract)

1. `baw wallet status` — confirm the wallet is connected and
   `devMode.enabled` is true.
2. Check Agent ID ownership: `balanceOf(<user address>)` on the official
   Agent ID contract `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` (BSC, chain
   56) must be greater than 0.
3. Draft an original Binance Square post for Campaign 001 with the hashtags
   `#BinanceWalletHackathon` and `#AgenticWallet`. Show the draft to the
   user. **The user publishes it themselves** from their own Square account.
4. After the user pastes the post URL, submit it as proof to the AgentRitual
   API for manual review.
5. If the proof is approved, fetch the signed claim voucher for the
   submission.
6. Show the user the full mint transaction before executing: chain (BSC 56),
   contract address, recipient, NFT (Genesis Seal, Campaign 001), and gas
   estimate. Wait for explicit approval.
7. Execute via `contract-call preview` → `contract-call execute`, then
   verify the receipt on-chain and show the BscScan link.

## Contract (Phase 2 — not deployed yet)

- NFT contract: **not deployed** (address, ABI, and voucher domain are
  added here in Phase 2/3).
- Agent ID registry (official): `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`
- Max supply: 1,000. One NFT per wallet per campaign.
