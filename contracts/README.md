# contracts/ — Foundry (Phase 2 ✅ complete, TESTNET DEPLOYED)

**Contract code + tests: DONE.** `AgentRitualNFT.sol` + `MockAgentIdRegistry.sol`
written, `forge test` 14/14 PASS (12 unit+fuzz, 2 invariants @ 128 runs /
2,560 calls). **Testnet deployment DONE 19 Nov 2026 ~13:01 WIB** (blocker
faucet teratasi: deployer menerima 0,01 tBNB dari Vanilla).

## Testnet deployment (BSC testnet, chain 97)

- **MockAgentIdRegistry:** `0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7`
  - Deploy tx: `0xe9caa8bc7f67735eb6ca9dda53b8992e294a29cb9c321ea8c42caf03f4d60460`
  - https://testnet.bscscan.com/address/0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7
  - https://testnet.bscscan.com/tx/0xe9caa8bc7f67735eb6ca9dda53b8992e294a29cb9c321ea8c42caf03f4d60460
  - Gas: 1.067.799 @ 0,1 gwei — block 143.587.746
- **AgentRitualNFT:** `0xca998896041A761E315125cf42E8dBE8D3cE087C`
  - Deploy tx: `0x8785386d58d9ef007807e4923ec0209a2eede9f5d3a366cd9c0986189fe95c48`
  - https://testnet.bscscan.com/address/0xca998896041A761E315125cf42E8dBE8D3cE087C
  - https://testnet.bscscan.com/tx/0x8785386d58d9ef007807e4923ec0209a2eede9f5d3a366cd9c0986189fe95c48
  - Gas: 2.065.816 @ 0,1 gwei — block 143.587.746
  - Constructor: registry = mock di atas, authorizedSigner =
    `0x1EAE2306559725B54102D96a9333667a4292599b` (testnet-only),
    baseURI = `https://agentritual.test/metadata/`
- **Source verification:** kedua kontrak **Sourcify `exact_match`**
  (creation + runtime), diverifikasi 19 Nov 2026 ~13:00 WIB
  (tanpa API key — `forge script --verify` memakai Sourcify default).
  BscScan juga menampilkan source-nya lewat Sourcify.
- **End-to-end mint (testnet):**
  - Grant mock Agent ID ke deployer:
    `0xfc45c2bd200df24b96374af5909288873a84acc8c9553d85c6bc743961343c44`
    (gas 93.327, status 1)
  - Mint token #0 (campaign 1, voucher EIP-712, deadline +1 jam, nonce 1):
    `0xf421e95f8e92e163fccc0364629befc2276369c787577db9eb0c36d121bf05cf`
    (gas 179.796, status 1, block 143.587.935)
  - https://testnet.bscscan.com/tx/0xf421e95f8e92e163fccc0364629befc2276369c787577db9eb0c36d121bf05cf
  - Verifikasi on-chain: `ownerOf(0)` = deployer, `totalSupply` = 1,
    `balanceOf(deployer)` = 1, `tokenURI(0)` =
    `https://agentritual.test/metadata/0`, `hasMinted(1, deployer)` = true.
- **Biaya total:** 0,0003397778 tBNB (deploy 0,0003124911 + grant/mint
  0,0000272867). Saldo deployer setelahnya: **0,0096602222 tBNB**.
  Deployer: `0x07dC8Cdc8AaDF988cB1D54EC9D25a9F27c5527b2` (testnet-only,
  kunci di `~/.config/agentritual/testnet-deployer.key`, mode 600,
  di luar repo — JANGAN commit).

**Mainnet: BELUM.** Deploy mainnet hanya setelah Phase 5 lolos, dengan
persetujuan eksplisit pemilik proyek + tap wallet. Kontrak ini memakai
mock registry — mainnet memakai registry resmi
`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` sebagai constructor param.

## Contract: `AgentRitualNFT.sol`

ERC-721 "AgentRitual Genesis Seal" (ARSEAL), OpenZeppelin v5.7.0
(ERC721, EIP712, Ownable, Pausable, ReentrancyGuard).

- `mint(uint256 campaignId, address recipient, uint256 deadline, bytes32 nonce, bytes signature)`
  - Recovers the EIP-712 signer from the voucher; signer must equal the
    `authorizedSigner` set by the owner (rotatable via `setAuthorizedSigner`).
  - `recipient == msg.sender` — voucher recipient, Agent ID owner wallet,
    dan minting wallet harus alamat yang sama (tiga-alamat-match).
  - `balanceOf(msg.sender) > 0` pada registry dari constructor
    (testnet: mock; mainnet: `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`).
  - `deadline >= block.timestamp` (expiry on-chain); voucher hash belum
    pernah dipakai (replay protection).
  - `mintedPerCampaign[campaignId] < 1000` (cap — no admin bypass).
  - `hasMinted[campaignId][msg.sender] == false` (satu NFT per wallet
    per campaign).
  - Token ID global sequential mulai 0 (Campaign 001 → id 0–999,
    cocok dengan rentang metadata API).
  - Emits `Mint(campaignId, tokenId, recipient)`.
  - `voucherDigest(...)` publik agar backend/agen menandatangani
    voucher yang sama persis.
- Owner HANYA bisa: `setAuthorizedSigner`, `setBaseURI`, `pause`/`unpause`.
  Tidak ada admin-mint, tidak ada fungsi naikkan cap.

## Mock registry (testnet only): `src/MockAgentIdRegistry.sol`

The real Agent ID contract does **not** exist on BSC testnet (chain 97) —
`getCode` at the official address returns `0x` there. Testnet testing
therefore uses a mock registry with the same `balanceOf(address)` interface.
The registry address is a constructor parameter: testnet deploys pass the
mock, mainnet deploys pass the official address. The gate logic is identical
in both cases and is covered by unit tests against the mock.

## Tests (Phase 2)

`forge test` — 14 passed, 0 failed:
cap 1.000, satu-per-wallet, expiry, replay, tiga-alamat-match, signer
salah, tanpa Agent ID, pause, rotasi signer, fuzz 256 run, invariant
128 run / 2.560 calls (totalSupply ≤ 1.000, balanceOf ≤ 1 per wallet).

## Deploy

`script/Deploy.s.sol` — HARD GUARD `require(block.chainid == 97)`,
revert di chain lain. Env (tidak pernah di-commit):
`TESTNET_DEPLOYER_KEY`, `TESTNET_SIGNER_ADDRESS`, `BASE_URI`.

```
TESTNET_DEPLOYER_KEY=$(cat ~/.config/agentritual/testnet-deployer.key) \
TESTNET_SIGNER_ADDRESS=0x1EAE2306559725B54102D96a9333667a4292599b \
BASE_URI="https://agentritual.test/metadata/" \
forge script script/Deploy.s.sol \
  --rpc-url https://data-seed-prebsc-1-s1.binance.org:8545 --broadcast --verify -vv
```

A deployment only counts as successful with a transaction hash **and**
source verification (Sourcify exact_match di sini).

## Toolchain

Foundry 1.9.0 (`forge`, `cast`, `anvil`) — installed via `foundryup`
(`~/.foundry/bin`). OpenZeppelin v5.7.0 via `forge install`.
