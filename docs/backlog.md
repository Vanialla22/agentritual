# Backlog — Phase 1 audit items (NOT built in Phase 2)

These four items came out of the Phase 1 audit. They are recorded here
with their intended phase. None of them is implemented in Phase 2.

## 1. Wallet ownership proof via signature challenge
- **Intended phase:** Phase 3/4 (API).
- **What:** before a submission is accepted, the API asks the submitting
  wallet to sign a one-time challenge (EIP-191 personal sign) proving it
  controls the claimed address. Today the API only validates the address
  format and checks `balanceOf` — anyone could submit a proof URL naming
  someone else's wallet.
- **Note:** this is separate from the EIP-712 claim voucher (Phase 2,
  on-chain). The challenge proves ownership at submission time; the
  voucher proves admin approval at mint time.

## 2. Strengthen audit-log controls
- **Intended phase:** Phase 4 (admin + tracker).
- **What:** the `audit_log` table is append-only by design (no
  UPDATE/DELETE endpoints), but enforcement is by convention only.
  Harden it: DB-level trigger/role that rejects UPDATE/DELETE, hash-chain
  each row to the previous row (tamper evidence), and an admin UI view
  that shows the full chain. Also enforce the self-approval block
  server-side (reviewer wallet != submitter wallet) — the prototype fix
  (Phase 1 step 0) is UI-level only.

## 3. Separate URL validation from content verification of submissions
- **Intended phase:** Phase 3/4 (API + admin review).
- **What:** today `POST /api/submissions` only validates the Square URL
  format (`binance.com/square/post/<id>`). Content verification (does the
  post exist, is it by the claimed account, does it carry the required
  hashtags, is it original) is a separate step and must stay separate:
  URL format = machine check at intake; content = manual admin review
  (Phase 4) with an explicit checklist, and later — only if an official
  Square read API exists — an automated content check. Never claim the
  URL check verifies content.

## 4. Rate limiting and spam protection for the API
- **Intended phase:** Phase 4/5 (API hardening).
- **What:** add per-IP and per-wallet rate limits on `POST
  /api/submissions` (e.g. max N submissions per wallet per campaign,
  burst limit per IP), plus a submission cooldown and a cap on pending
  submissions per wallet. Without this, one actor can flood the review
  queue. Revisit before any public launch; testnet/Phase 2 does not need
  it (no public API yet).

---

## Known Phase 2 follow-ups (found while building the contract)

- **API voucher nonce type mismatch:** `apps/api/src/voucher.ts`
  declares the EIP-712 `nonce` field as `uint256`, while
  `AgentRitualNFT` uses `bytes32 nonce` (per the Phase 2 spec). The
  on-chain type is authoritative. Phase 3 must change the API voucher
  type to `bytes32` (and the `ClaimVoucher.nonce` type) before the API
  signs real vouchers, or signatures will not verify on-chain.
- **API voucher domain chainId is hardcoded to 56** in
  `getVoucherDomain()`; the contract's EIP-712 domain uses
  `block.chainid`. Phase 3 must make the API chainId configurable
  (97 for testnet, 56 for mainnet) or testnet vouchers will not verify.
- **Token IDs are globally sequential starting at 0** (Campaign 001 →
  ids 0–999). A per-campaign counter was tried first and rejected: it
  collides token IDs across campaigns (proven by
  `test_OneMintPerWalletPerCampaign` failing with
  `ERC721InvalidSender`). The cap stays per-campaign.
