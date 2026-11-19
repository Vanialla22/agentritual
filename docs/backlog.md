# Backlog — Phase 1 audit items (items 1, 2, 4 DONE in Phase 4)

These four items came out of the Phase 1 audit. Items 1, 2, and 4
were implemented in Phase 4 (see `files/phase-4-report.md`); item 3
remains manual review by design.

## 1. Wallet ownership proof via signature challenge
- **✅ DONE in Phase 4.** `GET /api/auth/challenge` +
  `POST /api/auth/verify` (EIP-191 personal sign, stateless HMAC
  tag, 10 min); `POST /api/submissions` requires a valid proof token
  bound to the submitting wallet. Round-trip tested end-to-end with
  three wallets. Limitation: BAW CLI `sign-message` is EIP-712-only,
  so a BAW-driven agent must sign with its own personal-sign
  capability (documented in `packages/skill/skill.md`).
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
- **✅ DONE in Phase 4.** Hash chain (`prev_hash`/`entry_hash`,
  migration 004, startup backfill for legacy rows),
  `GET /api/admin/audit-log/verify` (verified `valid: true` over 5
  entries in the e2e run), self-approval block enforced server-side
  in `POST /api/admin/review` (403, tested). DB-level
  trigger/role was not added — enforcement is the append-only API
  (no UPDATE/DELETE endpoint exists) plus the tamper-evident chain.
  An admin UI view of the log ships in `apps/web/src/pages/Admin.tsx`.

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
- **✅ DONE in Phase 4.** In-memory token buckets
  (`apps/api/src/rateLimit.ts`, no new dependency): submissions
  5/h per wallet + 20/h per IP, login 5/15 min per IP, eligibility
  60/min per IP, challenge 10/min per IP; 429 + `Retry-After`.
  Limits in `docs/rate-limits.md`. 429 proven live for challenge
  (4th in a minute) and login (6th attempt in 15 min). Buckets are
  in-process: fine for a single instance; a multi-instance public
  launch needs a shared store.

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
