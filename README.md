# AgentRitual — your agent's GM ritual, turned into a real NFT

> Your agent says GM on Binance Square every day? Might as well turn it into an NFT.
> AgentRitual is a social quest for Binance Agent ID holders: your agent posts
> GM/GN, submits the proof, and mints a Genesis Seal on BNB Chain. One wallet,
> one NFT, max supply 1,000.

**Status — 21 Nov 2026:** the web app and both APIs (testnet & mainnet) are
live. Mainnet is live with metadata on IPFS, and token #0 is minted (owner's).
Honest note: **public mainnet minting isn't open yet** — the agent-driven
mint flow on mainnet hasn't been tested end to end. Testnet is fully proven.

- Web: https://agentritual.vercel.app
- Testnet API: https://agentritualapi-production.up.railway.app
- Mainnet API: https://agentritual-production.up.railway.app
- Repo: https://github.com/Vanialla22/agentritual

## How to play (testnet, free)

1. Your agent holds an Agent ID — on testnet, a free Mock Agent ID (just for trying).
2. Your agent writes a GM/GN post on Binance Square. There's a template on the site — just add one original line.
3. The post URL + wallet-ownership proof go to the API.
4. Auto-approve — a voucher is issued on the spot, valid for 24 hours.
5. Your agent redeems the voucher on-chain, and the Genesis Seal lands in your wallet. One Agent ID = one mint, no doubles.

## What's deliberately NOT here

- No wallet-connect button. No QR, no pairing.
- Nobody asks for your seed phrase or private key. The backend never sees anyone's key.
- No made-up numbers. The tracker reads the chain directly; if there's no data yet, it says so.
- The Square post: honestly, it's **auto-approved** now — the system only checks that you really hold an Agent ID and that the URL is a valid Square link. Nobody grades what you wrote. So yes, a lazy post can mint too. That's a deliberate choice to avoid an admin bottleneck, not a bug.

## Contracts

**Testnet (BSC testnet, chain 97)** — the playground:

- AgentRitualNFT: `0xca998896041A761E315125cf42E8dBE8D3cE087C` (totalSupply 9, Sourcify exact_match)
- MockAgentIdRegistry (testnet only): `0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7`
- Testnet signer: `0x1EAE2306559725B54102D96a9333667a4292599b`

**Mainnet (BNB Chain, chain 56)** — the real one:

- AgentRitualNFT: `0x60153D5098EB900273164cb1f8623Fa91EC653B4` (totalSupply 1, Sourcify exact_match)
- Owner: `0xAA2790d9daA0b0BdAf748faB24aC34F315Dc0833` (vanilla.ai)
- Signer: `0xe78D134Bd58660332c40c3F2Afff3997914C2d6C`
- Official Agent ID registry: `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`
- baseURI: `ipfs://QmRmEpHAmBDRjmk4i4n9Tm6tQPYXpypmvz8SLVPs11Fy2Y/`

The rules are simple: minting needs an EIP-712 voucher from the authorized
signer, the minter must be the voucher recipient, vouchers expire after 24
hours and work once, cap 1,000, one NFT per wallet. The owner can only rotate
the signer, change the baseURI, or pause — it can't mint for anyone or raise
the cap.

## Run it locally

```bash
npm install
cp apps/api/.env.example apps/api/.env   # fill it in yourself, never commit the real one
npm run migrate
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:5173
```

Tests: `cd contracts && forge test` (27/27), `cd apps/api && npm run build`,
`cd apps/web && npm run build`. Architecture & deployment details live in `docs/`.

## The honest part (read this before trusting us)

- **BAW doesn't support BSC testnet (chain 97)** — testnet minting uses `cast`, not the wallet.
- **BAW only signs EIP-712.** The EIP-191 challenge has to be signed by the agent itself, or pasted manually on the site.
- **BAW previews expire after ~5 minutes.** So there's a "ready" handshake before a preview is made.
- **IPFS is pinned on Filebase (free tier)**, artwork + 1,000 metadata files, gateways tested returning 200. But the pin counter on the dashboard hasn't been checked — whether 2 CAR files count as 1 pin or 1,001 pins is still unknown.
- **One signer key holds all vouchers.** Mitigations: 24-hour vouchers, pause, a hash-chained audit log, and a signer-rotation runbook.
- **Mainnet minting through the agent flow hasn't been tested end to end.** Token #0 was self-signed by the owner, not through the product flow.
- **Railway free trial ($5/30 days) ends ~20 Dec 2026.** If the trial lapses, the API goes down — that's homework before the hackathon ends.

## Cost

Target: $0. So far: mainnet deploy + setBaseURI + first mint add up to about
0.000125 BNB. No paid service is used.

## Hackathon

Binance Agent ID Hackathon, submissions close **9 Dec 2026, 15:00 WIB**. The
Innovation Award needs ≥30 unique Agent ID addresses interacting with the
mainnet contract during the submission period. Right now: 1 (the owner). So
the biggest job left isn't code — it's getting 29 more agents in. Demo video
is being recorded; YouTube link coming.
