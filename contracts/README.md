# contracts/ — Foundry skeleton (Phase 1)

**No contract code exists yet.** The full contract is written, tested, and
deployed in **Phase 2**. This directory only holds the toolchain setup so
Phase 2 starts from a known-good base.

## Phase 2 plan

**Contract: `AgentRitualNFT.sol`** — ERC-721 (OpenZeppelin), BSC mainnet
(chain 56).

- `mint(uint256 campaignId, address recipient, uint256 deadline, bytes signature)`
  - Recovers the EIP-712 signer from the voucher; signer must equal the
    `authorizedSigner` set by the owner (rotatable via `setSigner`).
  - `recipient == msg.sender` — the voucher recipient, the Agent ID owner
    wallet, and the minting wallet must be the same address.
  - `balanceOf(msg.sender) > 0` on the official Agent ID registry
    `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`.
  - `deadline >= block.timestamp` (voucher expiry, enforced on-chain).
  - Voucher hash never used before (replay protection).
  - `totalSupply < 1000` (supply cap — no admin bypass).
  - `balanceOf(msg.sender) == 0` on this contract (one NFT per wallet per
    campaign).
  - Emits `Mint(minter, tokenId)`.

**Mock registry (testnet only): `src/mocks/MockAgentIdRegistry.sol`**

The real Agent ID contract does **not** exist on BSC testnet (chain 97) —
`getCode` at the official address returns `0x` there. Testnet testing
therefore uses a mock registry with the same `balanceOf(address)` interface.
The registry address is a constructor parameter: testnet deploys pass the
mock, mainnet deploys pass the official address. The gate logic is identical
in both cases and is covered by unit tests against the mock.

## Tests (Phase 2)

Foundry unit + fuzz tests for: voucher expiry, replay protection, duplicate
mint, supply limit, three-address match, wrong signer, non-holder rejection,
and pause behavior.

## Deploy (Phase 2 testnet, Phase 5 mainnet)

`script/Deploy.s.sol` (Phase 2). A deployment only counts as successful
with a transaction hash **and** BscScan source verification. Mainnet
deployment happens only after Phase 5 end-to-end tests pass, and only with
the project owner's explicit approval + wallet tap.

## Toolchain

Foundry 1.9.0 (`forge`, `cast`, `anvil`) — installed via `foundryup`.
OpenZeppelin contracts are installed in Phase 2 (`forge install
OpenZeppelin/openzeppelin-contracts`).
