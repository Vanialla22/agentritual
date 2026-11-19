// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRitualNFT} from "../src/AgentRitualNFT.sol";
import {MockAgentIdRegistry} from "../src/MockAgentIdRegistry.sol";

/// @notice Deploy AgentRitualNFT + MockAgentIdRegistry to BSC TESTNET only.
/// @dev HARD GUARD: reverts on any chain other than 97. This script must
///      NEVER be pointed at mainnet (chain 56). Env vars (never committed):
///        TESTNET_DEPLOYER_KEY  - testnet-only deployer private key (tBNB)
///        TESTNET_SIGNER_ADDRESS - testnet-only voucher signer address
///        BASE_URI              - metadata base URI (placeholder for now)
///      Run: forge script script/Deploy.s.sol --rpc-url <bsc-testnet-rpc>
///           --broadcast --verify --etherscan-api-key <key> -vv
contract Deploy is Script {
    function run() external {
        require(block.chainid == 97, "Deploy: BSC testnet (chain 97) only");
        uint256 deployerPk = vm.envUint("TESTNET_DEPLOYER_KEY");
        address signer = vm.envAddress("TESTNET_SIGNER_ADDRESS");
        string memory baseURI = vm.envString("BASE_URI");

        vm.startBroadcast(deployerPk);
        MockAgentIdRegistry registry = new MockAgentIdRegistry();
        AgentRitualNFT nft = new AgentRitualNFT(address(registry), signer, baseURI);
        vm.stopBroadcast();

        console.log("chainId:", block.chainid);
        console.log("deployer:", vm.addr(deployerPk));
        console.log("MockAgentIdRegistry:", address(registry));
        console.log("AgentRitualNFT:", address(nft));
        console.log("authorizedSigner:", signer);
        console.log("baseURI:", baseURI);
    }
}
