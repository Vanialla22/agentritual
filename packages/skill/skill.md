# AgentRitual Agent Skill

> **Status: Phase 3 (testnet).** The AgentRitualNFT contract is deployed
> and verified on BSC testnet (chain 97); the submission + eligibility
> API is live in this repo. Mainnet deployment has NOT happened — the
> mainnet NFT contract address below is a placeholder until Phase 5.
> Admin review and voucher issuance are manual steps (Phase 4): a
> submission stays `pending` until an admin approves it and signs a
> claim voucher.

## What this skill is for

AgentRitual is an agent-native social quest and NFT mint platform for
the Binance Agent ID Hackathon. The user asks their own AI agent
(Binance Agentic Wallet via BAW CLI, or Binance AI Pro) to join
Campaign 001: prove Agent ID ownership, draft a Binance Square post,
submit the post URL for manual review, and — once a claim voucher is
issued — mint the Genesis Seal NFT.

Campaign 001: max supply 1,000, one NFT per wallet per campaign,
enforced by the smart contract, not by the website.

## Prerequisites (check before starting)

1. The user has the **Binance App** with an **Agentic Wallet**.
2. The user has **claimed a Binance Agent ID** (`.ai` name) — the
   Agentic Wallet address must hold at least one Agent ID
   (`balanceOf > 0` on the registry below).
3. **Developer Mode is ON** in the Agentic Wallet (Binance App →
   Agentic Wallet management page → Settings → Developer Mode).
   Custom contract calls are impossible without it. Confirm with
   `baw wallet settings --json` (`devMode.enabled` must be `true`).
4. The Agentic Wallet holds a little BNB for gas (a mint costs
   roughly 0.00002–0.00004 BNB at normal gas prices).
5. The agent runs in the **user's own environment** (their machine,
   their BAW CLI pairing, or their Binance AI Pro). Never on a
   third-party server.

## Hard rules (never break these)

1. **Preview first, always.** Before any transaction, run
   `contract-call preview`, show the user the parsed transaction and
   the risk details, and wait for their explicit confirmation.
   Execute only with the `requestId` from a successful preview.
2. **Never ask for a seed phrase, private key, API secret, or
   pairing code.** Not for the wallet, not for Square, not for
   anything. The user publishes the Square post themselves and
   approves the mint themselves.
3. **Never instruct the user to enable Secure Auto Sign** or to skip
   a confirmation step.
4. **The website never shows a QR login.** Sign-in to the Agentic
   Wallet happens only through Binance AI Pro or a trusted agent of
   the user's own. If the user is asked to scan a QR on a
   third-party website, stop and warn them.
5. **Three addresses must match.** The Agent ID owner wallet, the
   voucher recipient, and the minting wallet must be the same
   address. If they differ, stop and tell the user.
6. **No claim without evidence.** Never tell the user a mint
   succeeded until the transaction receipt is verified on-chain and
   the explorer link is shown.
7. **Voucher deadlines are short.** A claim voucher is valid for at
   most 1 hour after issuance. If the voucher is expired, ask the
   admin for a fresh one — never mint with an expired voucher.
8. **One mint per wallet per campaign.** If the wallet already
   minted for this campaign, stop — the contract will revert
   `AlreadyMinted`.

## Contract reference

| Item | Testnet (chain 97, LIVE) | Mainnet (chain 56) |
|---|---|---|
| AgentRitualNFT | `0xca998896041A761E315125cf42E8dBE8D3cE087C` | not deployed yet |
| Agent ID registry | mock `0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7` | official `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |
| Explorer | https://testnet.bscscan.com | https://bscscan.com |

- NFT: "AgentRitual Genesis Seal" (ARSEAL). EIP-712 domain
  `AgentRitual` / `1`. Voucher struct:
  `ClaimVoucher(uint256 campaignId, address recipient, uint256 deadline, bytes32 nonce)`.
  `mint(campaignId, recipient, deadline, nonce, signature)`.
- Agent ID registry is an ERC-721; the gate is
  `balanceOf(wallet) > 0`. The mock registry exists ONLY on testnet
  and must never be used on mainnet.
- API base URL (local dev): `http://localhost:3001`. Production URL
  is set when the API is deployed (Phase 4).

## Flow

### 1. Confirm the wallet and Developer Mode

```bash
baw wallet status --json
baw wallet settings --json   # devMode.enabled must be true
baw wallet address --json    # this is the Agentic Wallet address
```

If Developer Mode is off or expired, tell the user how to turn it
on (Binance App → Agentic Wallet management → Settings → Developer
Mode) and wait until it is on. Do not proceed to any contract call.

### 2. Check Agent ID ownership (read-only)

Call `balanceOf(<agentic wallet address>)` on the Agent ID registry
for the chain in use (mainnet: official address above; testnet:
mock address above). Calldata for `balanceOf(address)` is
`0x70a08231` + the address left-padded to 32 bytes. With BAW:

```bash
baw contract-call preview --binanceChainId 56 \
  --from <agentic wallet address> \
  --to 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F \
  --value 0 \
  --inputData 0x70a08231<address-padded-to-32-bytes> --json
```

This is a read-only simulation — do NOT execute it. Read the
simulation result: the returned value must be greater than 0. The
same check is available without a wallet at
`GET /api/eligibility?address=<address>` on the AgentRitual API.

If the wallet holds no Agent ID, stop and tell the user: they need
to claim an Agent ID in the Binance App first.

### 3. Draft the Binance Square post

Draft an ORIGINAL post about AgentRitual / Campaign 001 for the user
to publish. Requirements:

- Include the hashtags `#BinanceWalletHackathon` and
  `#AgenticWallet`.
- Original text — no copy-paste spam, no promised returns, no
  claim of Binance endorsement.
- Keep it short and human: what the quest is, that an Agent ID is
  required, and that the NFT is capped at 1,000.

Show the draft to the user. **The user publishes it themselves**
from their own Binance Square account. Never ask for their Square
password or API key.

### 4. Prove wallet ownership, then submit the post URL as proof

Before submitting, prove the user controls the wallet. Request a
challenge, have the user sign it, verify the signature, then submit
with the proof token:

```bash
# 1. Challenge (10 min expiry, stateless HMAC tag — no DB row)
curl "<API>/api/auth/challenge?address=<agentic wallet address>"
# → { address, message, expiresAt, tag }

# 2. The USER signs the exact message with their wallet
#    (personal_sign / eth_sign). This is a harmless ownership
#    statement — it authorizes nothing and shares no key.
#    NOTE: BAW CLI `sign-message` is EIP-712-only and cannot
#    personal-sign this challenge. Sign it with the agent's own
#    personal-sign capability (ethers/cast/AI Pro) instead.

# 3. Verify the signature → proof token (10 min, bound to the wallet)
curl -X POST <API>/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"address":"<wallet>","message":"<challenge message>","tag":"<tag>","signature":"<0x signature>"}'
# → { address, proofToken }

# 4. Submit the proof with the token
curl -X POST <API>/api/submissions \
  -H 'Content-Type: application/json' \
  -d '{"wallet":"<agentic wallet address>","squareUrl":"<post URL>","campaignId":"001","proofToken":"<proofToken>"}'
```

Without a valid proof token the API refuses the submission (401) —
so nobody can submit a proof URL in someone else's name. The API
also validates the URL format (`binance.com/square/post/<id>`) AND
checks Agent ID ownership on-chain before accepting. A URL alone is
not proof: an admin reads the post before approving (manual review,
Phase 4). The response is a submission with status `pending`.

### 5. Check submission status

```bash
curl <API>/api/submissions/<submission id>
```

While the status is `pending`, wait — do not mint. When the status
is `approved`, the response carries the claim voucher
(`campaignId`, `recipient`, `deadline`, `nonce`, `signature`).
If the status is `rejected`, tell the user why (the admin's note)
and stop.

### 6. Present the mint transaction — then wait

Before executing anything, show the user the full transaction:

- Chain: BSC mainnet (56) — or BSC testnet (97) for a test mint.
- Contract: AgentRitualNFT address (table above).
- Recipient: the user's Agentic Wallet address (must equal the
  voucher recipient and the Agent ID owner).
- NFT: Genesis Seal, Campaign 001, max supply 1,000, one per wallet.
- Voucher deadline: show the exact expiry time; refuse to proceed
  if it is already past.
- Gas estimate: from the preview's simulation result.

Wait for the user's EXPLICIT approval (e.g. "gas, execute"). No
approval, no execute.

### 7. Mint via preview → execute, then verify

Build the `mint(uint256,address,uint256,bytes32,bytes)` calldata
from the voucher fields, then:

```bash
baw contract-call preview --binanceChainId 56 \
  --from <agentic wallet address> \
  --to <AgentRitualNFT address> \
  --value 0 --inputData <mint calldata> --json
```

Show the user the parsed transaction, risks, and any authority
changes from the preview. Only after their explicit confirmation:

```bash
baw contract-call execute --requestId <requestId from preview> --json
```

Then verify on-chain: fetch the receipt by the returned `txHash`,
confirm status success, read `ownerOf(tokenId)` / `totalSupply()`
on the NFT contract, and show the user the BscScan explorer link.
Only then say the mint succeeded.

## Copy-paste user prompt

The user pastes this exact text to their own AI agent to start the
quest:

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
4. After I paste the post URL, prove I own the wallet first: request
   an ownership challenge from the API, sign the challenge message
   with my wallet, verify the signature, then submit the proof with
   the proof token.
5. If the proof is approved and a claim voucher is issued, show me
   the full mint transaction first — chain, contract address,
   recipient, NFT, and gas estimate — and wait for my explicit
   approval before executing anything.

Rules: never ask me for a seed phrase, private key, API secret, or
pairing code. Never enable Secure Auto Sign or skip the preview +
confirmation step. This website never shows a QR login — sign in
only through Binance AI Pro or a trusted agent of my own.
```

## Known limitations (Phase 3)

- **BAW CLI does NOT support BSC testnet (chain 97) — VERIFIED
  empirically in Phase 3.** `baw wallet chains` lists 8453, 56, 1,
  137, 4663, CT_501, 42161 — no 97 — and a testnet `contract-call
  preview --binanceChainId 97` fails with code 351721
  ("No wallet address found for the selected network"). The
  Agentic Wallet has no testnet address, so NO testnet contract
  call (not even a read-only preview) is possible through BAW.
  Consequence: the testnet flow in this skill can only be executed
  with developer tooling (cast/forge), as done in the Phase 2/3
  e2e tests. The MAINNET flow (chain 56) IS supported: a read-only
  `balanceOf` preview on the real Agent ID registry simulates
  cleanly (simulationCode 000000000, no risks).
- **Binance AI Pro:** NOT validated from this environment (it needs
  the user's phone + app). The live-test script is in
  `docs/ai-pro-test.md`; status UNVALIDATED until a user runs it.
- **Voucher issuance is manual** until the Phase 4 admin review
  flow ships. Do not invent an approval.
- **Agent ID verification in the API is read-only** (`balanceOf`).
  Wallet-ownership proof via a signature challenge is Phase 4
  scope (backlog item 1).
