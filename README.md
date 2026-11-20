# AgentRitual 🤖
### Your agent says GM. Now make it count.

> Your agent says GM on Binance Square every day. Why not turn that ritual into something permanent?
>
> AgentRitual is an agent-native social quest for Binance Agent ID holders. Complete a GM/GN quest, prove wallet eligibility, submit your Square post, and claim a Genesis Seal NFT on BNB Chain.
>
> **One wallet. One Genesis Seal. 1,000 max supply. No need to say GM 1,000 times.**

🌐 **Website:** https://agentritual.vercel.app
📦 **Repository:** https://github.com/Vanialla22/agentritual
🔗 **Testnet API:** https://agentritualapi-production.up.railway.app
🔗 **Mainnet API:** https://agentritual-production.up.railway.app

---

## 🚀 Project Status — 21 November 2026

AgentRitual has moved beyond the drawing-board stage.

- Web application deployed.
- Testnet and mainnet APIs deployed.
- Smart contracts deployed on BNB Chain.
- Contract source verified through Sourcify (`exact_match`).
- NFT metadata and artwork hosted on IPFS.
- Genesis NFT #0 successfully minted by the project owner.
- Testnet contract and mint workflow tested.
- Agent-driven mainnet minting is still awaiting its first complete end-to-end test.

**Important:** Mainnet infrastructure is live, but public mainnet minting is not open yet. Please don't confuse a successful preview with a completed transaction. Blockchain is very literal about these things.

---

## 💡 What is AgentRitual?

AgentRitual turns a simple social interaction into an on-chain experience.

The idea is straightforward:

1. Your AI agent helps you prepare a GM/GN post.
2. You publish it yourself on Binance Square.
3. Your agent helps verify wallet ownership and submit the proof.
4. The campaign system checks eligibility and issues a claim voucher when requirements are satisfied.
5. Your agent prepares the mint transaction.
6. You review and explicitly approve the transaction.

The result is a Genesis Seal NFT on BNB Chain.

No wallet-connect button. No QR pairing. No handing your keys to a random website.

**Your agent assists. You stay in control.**

---

## 🎮 How to Play

### Testnet — The Playground

Want to try before using real BNB?

1. Use a testnet wallet and the project's Mock Agent ID.
2. Ask your agent to read the AgentRitual skill.
3. Prepare an original GM/GN post for Binance Square.
4. Publish the post yourself.
5. Submit the post URL and complete wallet-ownership verification.
6. Once eligibility checks pass, receive a claim voucher.
7. Preview the mint transaction and execute it in the test environment.

Testnet uses a mock Agent ID registry because the official Binance Agent ID registry is not deployed on BSC testnet.

Testnet is for experimentation, not proof of mainnet eligibility.

### Mainnet — The Real Playground

Campaign 001 requires:

- A valid Binance Agent ID.
- The Agent ID owner wallet must be the wallet submitting and minting.
- A valid Binance Square post URL.
- Wallet-ownership verification.
- A valid claim voucher.

The Agent ID owner, voucher recipient, and NFT recipient must be the same address.

The campaign has a maximum supply of 1,000 NFTs, with one NFT per wallet per campaign enforced by the smart contract.

Mainnet agent-driven minting remains under testing. Actual mint execution requires the user's explicit approval.

---

## 🔐 Security by Design

We don't want an AI agent to become that friend who clicks every button without reading anything.

AgentRitual is designed around a few important principles.

### 1. No Private Key Collection

The website does not request:

- Seed phrases.
- Private keys.
- API secrets.
- QR login or pairing codes.

The backend never needs the user's private key.

### 2. Wallet Ownership Verification

Before submitting a campaign proof, users must complete a one-time ownership challenge.

The API verifies the wallet signature before accepting the proof submission.

For Binance Agentic Wallets that cannot use `personal_sign`, the workflow supports EIP-712 typed-data signing.

### 3. EIP-712 Claim Vouchers

Minting requires a signed voucher from the authorized signer.

The smart contract validates the voucher, recipient, campaign, deadline, and replay protection.

### 4. Human-Controlled Execution

A successful submission does not automatically mint an NFT.

The agent must show the transaction details and wait for the user's explicit approval.

No blind signing. No surprise minting.

### 5. On-Chain Supply Enforcement

The smart contract enforces:

- Maximum 1,000 NFTs per campaign.
- One NFT per wallet per campaign.
- Voucher expiry.
- Replay protection.
- Agent ID ownership verification.
- Recipient and caller address matching.

The website cannot override these contract rules.

---

## 🧩 Campaign 001 — The Genesis Quest

The first AgentRitual campaign is simple:

**Say GM/GN. Share your participation. Claim your Genesis Seal.**

Square post requirements:

- Include `#BinanceWalletHackathon`.
- Include `#AgenticWallet`.
- Post about AgentRitual or Campaign 001.
- Use your own Binance Square account.
- Submit the post URL.

The submission workflow checks wallet eligibility, wallet ownership, and the submitted proof URL.

A small transparency note: the system does not independently verify Square account ownership, post originality, likes, or engagement. The campaign is designed to make participation accessible without creating a manual-review bottleneck.

Yes, even a lazy GM can qualify if the technical requirements pass. We are building an agent-native quest, not a writing competition. 😄

---

## 📊 Live Mint Tracker

The tracker reads data directly from the NFT contract.

It displays:

- Total minted supply.
- Remaining supply.
- Recent mint events.
- Mainnet contract information.

No manually inflated numbers. No imaginary NFT holders.

If nobody mints, the tracker should say nobody minted.

Simple concept. Surprisingly important.

---

## 📜 Smart Contracts

### Testnet — BNB Smart Chain (Chain ID 97)

| Component | Address |
|---|---|
| AgentRitualNFT | `0xca998896041A761E315125cf42E8dBE8D3cE087C` |
| MockAgentIdRegistry | `0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7` |
| Testnet signer | `0x1EAE2306559725B54102D96a9333667a4292599b` |

Testnet contract:
https://testnet.bscscan.com/address/0xca998896041A761E315125cf42E8dBE8D3cE087C

### Mainnet — BNB Smart Chain (Chain ID 56)

| Component | Address |
|---|---|
| AgentRitualNFT | `0x60153D5098EB900273164cb1f8623Fa91EC653B4` |
| Official Agent ID Registry | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |
| Owner | `0xAA2790d9daA0b0BdAf748faB24aC34F315Dc0833` |

Mainnet contract:
https://bscscan.com/address/0x60153D5098EB900273164cb1f8623Fa91EC653B4

### Contract Design

AgentRitualNFT is an ERC-721 contract using OpenZeppelin v5.7.0.

Main components:

- ERC721
- EIP712
- Ownable2Step
- Pausable
- ReentrancyGuard

The owner can:

- Rotate the authorized signer.
- Update the metadata base URI.
- Pause or unpause the contract.

The owner cannot:

- Mint NFTs directly through an admin-mint function.
- Bypass the campaign supply cap.
- Mint twice for the same wallet in one campaign.

The contract uses sequential token IDs starting at zero.

### Test Results

`forge test`

**27 passed, 0 failed.**

Coverage includes:

- Unit and fuzz tests.
- Supply-cap enforcement.
- One-per-wallet enforcement.
- Expiry and replay protection.
- Address matching.
- Invalid signatures.
- Agent ID eligibility.
- Pause functionality.
- Signer rotation.
- Invariant tests.
- Ownership and access-control tests.

Passing tests are a strong development milestone, not a guarantee that no vulnerability exists.

---

## 🗂️ Metadata & IPFS

NFT artwork and metadata are hosted on IPFS.

Mainnet Base URI:

`ipfs://QmRmEpHAmBDRjmk4i4n9Tm6tQPYXpypmvz8SLVPs11Fy2Y/`

Pinning provider: Filebase.

The collection is designed for 1,000 metadata entries.

IPFS availability depends on pinning and gateway infrastructure. Long-term pinning and backup arrangements remain operational considerations.

We like free infrastructure. We just don't want free infrastructure to disappear on a Monday morning.

---

## 🤖 Agent Integration

AgentRitual is designed to be operated through an AI agent in the user's own environment.

The project includes an agent skill (`skill.md`) that explains the campaign workflow.

Supported workflow considerations:

- Binance Agentic Wallet compatibility.
- EIP-712 typed-data signing.
- Challenge and proof verification.
- Voucher retrieval.
- Transaction preview.
- Explicit user confirmation.

### Known Limitations

We prefer documenting limitations rather than pretending they don't exist.

- Binance Agentic Wallet does not support BSC testnet (Chain ID 97); testnet mint testing uses Foundry `cast`.
- BAW supports EIP-712 signing, while the EIP-191 challenge requires a compatible signing method or manual signature flow.
- BAW transaction previews have a limited lifetime, requiring a fresh preparation handshake.
- Agent-driven mainnet minting has not yet completed a full end-to-end test.
- The backend signer remains a critical trust component and requires careful secret management and rotation.
- API availability depends on the current Railway hosting arrangement.

---

## 🛠️ Run Locally

Requirements:

- Node.js
- npm
- Foundry

Clone the repository:

```bash
git clone https://github.com/Vanialla22/agentritual.git

cd agentritual

npm install
```

Configure the API:

```bash
cp apps/api/.env.example apps/api/.env
```

Fill in the required environment variables locally.

**Never commit real secrets.**

Run database migrations:

```bash
npm run migrate
```

Start the API:

```bash
npm run dev:api
```

Start the web application:

```bash
npm run dev:web
```

Local endpoints:

- API: `http://localhost:3001`
- Web: `http://localhost:5173`

Build checks:

```bash
cd contracts
forge test

cd ../apps/api
npm run build

cd ../web
npm run build
```

See the `docs/` directory for architecture and deployment details.

---

## 💰 Cost Philosophy

**Target: $0 operating cost.**

So far, the project has used:

- BNB for deployment and transaction gas.
- Filebase free-tier IPFS pinning.
- Railway hosting trial.
- Open-source development tools.
- Foundry and OpenZeppelin.

The mainnet deployment, Base URI update, and first mint have cost approximately 0.000125 BNB according to the project's deployment records.

Free-tier services have limits. Hosting, storage, and availability may require future adjustments.

Built on a small budget. Not built on imaginary infrastructure.

---

## 🏁 Binance Agent ID Hackathon

AgentRitual is built for the Binance Agent ID Hackathon.

Submission deadline:

**9 December 2026 — 15:00 WIB**

The Innovation Award requires at least 30 unique Agent ID addresses interacting with the mainnet contract during the submission period.

Current project target: **35 unique addresses.**

Why 35?

A little buffer is better than discovering that one address didn't qualify at the last minute.

The priority is genuine participation, verifiable on-chain interactions, and a working agent workflow.

---

## 🙌 The Builder's Note

AgentRitual started with a simple thought:

If AI agents are becoming part of our daily Web3 activities, why not give them a small social ritual of their own?

This project is an experiment in combining social participation, Agent ID eligibility, AI-assisted workflows, and on-chain ownership.

It is not trying to replace human decisions with AI.

It is trying to make the boring parts easier while keeping important decisions in human hands.

We are a small project with a small budget, a limited storage allowance, and a very ambitious to-do list.

But hey, at least the contracts are on-chain.

**Say GM. Let your agent help. Keep control of your wallet.**

Welcome to AgentRitual. 🤖

---

*Built independently by Vanilla22.*
