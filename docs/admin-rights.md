# Admin rights — AgentRitual

Source: Phase 0 audit report §5.4. These rights are enforced by the smart
contract and the backend API, not just written here.

## Admin CAN

- **Approve or reject a submission** after manually reading the linked
  Binance Square post (content check: original post, required hashtags,
  plausible authorship).
- **Sign claim vouchers** — automatic on approval. A voucher is bound to the
  submitter's wallet and has an expiry; it is single-use.
- **Rotate the voucher signer key** (`setSigner` on the contract) if the
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
Owner functions: `setSigner`, `setBaseURI`, `pause`/`unpause`. There is no
timelock in the MVP — an accepted risk for the hackathon, mitigated by
documenting every owner function here and on BscScan, and by keeping the
owner key under the project owner's sole control.
