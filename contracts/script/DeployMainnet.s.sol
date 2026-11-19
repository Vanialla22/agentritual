// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRitualNFT} from "../src/AgentRitualNFT.sol";

/// @notice Deploy AgentRitualNFT to BSC MAINNET only (Phase 5).
/// @dev HARD GUARDS (audit L-4):
///      - reverts on any chain other than 56 (BSC mainnet);
///      - the Agent ID registry is HARD-CODED to the real mainnet
///        registry 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F and the
///        script requires registry == that address, so the testnet
///        mock registry (0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7)
///        can NEVER be deployed as the registry on mainnet.
///      - NO mock is deployed by this script. No testnet code path.
///      Env vars (never committed, never a real key in a file):
///        MAINNET_DEPLOYER_KEY    - mainnet deployer private key (BNB)
///        MAINNET_SIGNER_ADDRESS  - mainnet voucher signer address
///                                  (a NEW key — never the testnet one)
///        BASE_URI                - final IPFS metadata base URI,
///                                  e.g. ipfs://<CID>/ (see docs/metadata.md)
///      Dry-run ONLY until the owner approves the real deploy
///      (forge 1.9.0 has NO --dry-run flag — omitting --broadcast
///      IS the dry run; it only simulates, sends nothing):
///        forge script script/DeployMainnet.s.sol --fork-url <bsc-rpc>
///      Real deploy (owner approval + wallet tap required, Phase 5):
///        forge script script/DeployMainnet.s.sol --rpc-url <bsc-rpc>
///          --broadcast --verify --etherscan-api-key <key> -vv
///      After deploy: record the contract address AND the deployment
///      block (BscScan) and set NFT_DEPLOY_BLOCK on the API (M-1).
contract DeployMainnet is Script {
    /// @dev The REAL Binance Agent ID registry on BSC mainnet.
    address internal constant REAL_AGENT_ID_REGISTRY =
        0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;

    /// @dev The TESTNET mock registry. Must never be the registry on
    ///      mainnet — the equality check below makes this impossible.
    address internal constant MOCK_REGISTRY =
        0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7;

    function run() external {
        require(block.chainid == 56, "DeployMainnet: BSC mainnet (chain 56) only");
        address registry = REAL_AGENT_ID_REGISTRY;
        require(registry == REAL_AGENT_ID_REGISTRY, "DeployMainnet: registry must be the real Agent ID registry");
        require(registry != MOCK_REGISTRY, "DeployMainnet: mock registry is forbidden on mainnet");

        uint256 deployerPk = vm.envUint("MAINNET_DEPLOYER_KEY");
        address signer = vm.envAddress("MAINNET_SIGNER_ADDRESS");
        string memory baseURI = vm.envString("BASE_URI");

        vm.startBroadcast(deployerPk);
        AgentRitualNFT nft = new AgentRitualNFT(registry, signer, baseURI);
        vm.stopBroadcast();

        console.log("chainId:", block.chainid);
        console.log("deployer:", vm.addr(deployerPk));
        console.log("agentIdRegistry (real):", registry);
        console.log("AgentRitualNFT:", address(nft));
        console.log("authorizedSigner:", signer);
        console.log("baseURI:", baseURI);
        console.log("owner:", nft.owner());
    }
}
