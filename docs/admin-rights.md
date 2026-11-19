# Admin rights — AgentRitual

Source: Phase 0 audit report §5.4. These rights are enforced by the smart
contract and the backend API, not just written here.

## Admin authentication (Phase 4, hardened in the Phase 4 review)

- **Password:** checked against a scrypt hash in env
  (`ADMIN_PASSWORD_HASH`). Generate it with
  `ADMIN_PASSWORD='...' npm run admin:hash` — the password is never
  stored in the repo or in any file. Wrong password → generic 401
  ("invalid credentials"). Login is rate-limited: 5 attempts / 15 min
  per IP, then 429 (see `docs/rate-limits.md`).
- **Session:** a successful login returns an HMAC-signed bearer token
  (secret `ADMIN_SESSION_SECRET`, fail-closed when unset), valid 2 h.
  The token is kept in memory in the admin UI — never localStorage.
  Every `/api/admin/*` route except login requires it (missing /
  invalid / expired → 401).
- **Logout + revocation:** `POST /api/admin/logout` revokes the current
  token server-side (its SHA-256 hash is stored in `revoked_sessions`;
  the token itself is never stored). A revoked token is rejected even
  before its 2 h expiry. The admin UI has a "Sign out (revokes
  session)" button. Log out when done — do not rely on expiry alone.
- **Secret rotation:** changing `ADMIN_SESSION_SECRET` invalidates ALL
  admin sessions immediately (the HMAC key changes, so every old token
  fails verification). Procedure: (1) set the new secret in the
  deployment env, (2) restart the API, (3) log in again — all other
  admin sessions are dead. There is no key-id versioning: rotation is
  all-or-nothing by design (documented limitation). Rotate the secret
  after any suspected session-token leak, and whenever an admin leaves.
- **Self-approval block:** when `ADMIN_WALLET` is set, the review API
  refuses (403) an APPROVE on a submission from the admin's own
  wallet. REJECT is allowed for your own submission (it grants nothing
  and keeps the queue decidable). If `ADMIN_WALLET` is unset, the
  server logs a startup warning that the block is inactive — set it
  before any public use.
- **Voucher lifetime:** approvals sign vouchers with a deadline of at
  most 1 hour (enforced in `signVoucher` itself, audit M-3). The
  audit-log entry for an approval records the voucher DIGEST, never
  the signature.
- **Audit log:** every decision is appended to a hash-chained,
  append-only log (`GET /api/admin/audit-log`, verify with
  `GET /api/admin/audit-log/verify`). There is no edit or delete path.
  Rows also carry an app-assigned sequence number (`seq`), and verify
  enforces strictly increasing seq — a deletion or reorder that only
  fixes the hashes is still caught.
- **External checkpoint (read this — the chain is tamper-EVIDENT, not
  tamper-PROOF):** a hash chain alone cannot detect a full rewrite by
  someone with database write access — they can recompute every hash
  (and seq) from a forged first row, and verify() will report
  valid=true. What catches that is an EXTERNAL checkpoint: after each
  review session, record the output of
  `GET /api/admin/audit-log/checkpoint` (`latestEntryHash`, `latestSeq`,
  `checked`) OUTSIDE this database — a note on a second machine, a
  message to a second admin, a public post, or an on-chain anchor.
  Later, call
  `GET /api/admin/audit-log/verify?expectedLatest=<hash>&expectedCount=<n>`
  and check `checkpointMatch: true`. If it is false, the log was
  rewritten after the checkpoint — investigate before trusting any
  decision in it. A checkpoint recorded before a rewrite is what makes
  the rewrite detectable; without one, a full rewrite is invisible.
- **Authorized campaigns:** only campaigns in `AUTHORIZED_CAMPAIGNS`
  (env, default `001`) accept submissions, reviews, and vouchers.
  A submission, review, or voucher signing for any other campaign is
  refused with 400. Add a campaign to the env list ONLY when it is
  actually launched — never pre-authorize a campaign id.
- **Ownership proof (single-use):** a challenge nonce verifies exactly
  once, and a proof token backs exactly one successful submission.
  A replayed challenge or token is refused (400/401). Users request a
  fresh challenge for each submission.

## Admin CAN

- **Approve or reject a submission** after manually reading the linked
  Binance Square post (content check: original post, required hashtags,
  plausible authorship).
- **Sign claim vouchers** — automatic on approval. A voucher is bound to the
  submitter's wallet and has an expiry; it is single-use.
- **Rotate the voucher signer key** (`setAuthorizedSigner` on the contract) if the
  signing key is ever compromised.
- **Change the NFT metadata base URI.**
- **Pause minting in an emergency** (pause stops minting; it does not change
  supply, ownership, or any minted token).

## Admin CANNOT

- **Mint an NFT for anyone.** Minting only happens through the contract,
  called by the voucher holder's own wallet.
- **Raise the 1,000 supply cap** or bypass one-per-wallet. Both are enforced
  in the contract; there is no admin function for them.
- **Move a voucher or change its recipient** after it is signed. The
  voucher's recipient is part of the signed EIP-712 data.
- **Change tracker numbers.** The tracker reads contract state and Mint events
  from the chain.
- **Approve their own submission.** A submission from the reviewer's own
  wallet is blocked from self-approval — in the admin UI and in the review
  API (Phase 4).
- **See or store any user's private key.** The backend never receives one.
  The only key the backend holds is the project's own voucher-signer key
  (env var `ADMIN_SIGNER_PRIVATE_KEY`, never committed to the repo).

## Contract ownership

Owner = the deployer wallet (project owner, via Binance Agentic Wallet).
Owner functions: `setAuthorizedSigner`, `setBaseURI`, `pause`/`unpause`. There is no
timelock in the MVP — an accepted risk for the hackathon, mitigated by
documenting every owner function here and on BscScan, and by keeping the
owner key under the project owner's sole control.
