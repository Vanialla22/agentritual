// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRitualNFT} from "../src/AgentRitualNFT.sol";
import {MockAgentIdRegistry} from "../src/MockAgentIdRegistry.sol";

/// @notice Invariant tests for AgentRitualNFT (Phase 2).
/// @dev A handler performs random mint attempts (mostly valid vouchers,
///      sometimes wrong-signer or expired ones) against campaign 1 only.
///      Invariants: totalSupply never exceeds 1,000, and no wallet ever
///      holds 2 tokens for campaign 1.
contract MintHandler is Test {
    AgentRitualNFT public nft;
    MockAgentIdRegistry public registry;

    uint256 internal constant SIGNER_PK = 0xA11CE5EED;
    uint256 internal constant OTHER_PK = 0xBAD5EED;
    address internal signer;

    address[] public actors;
    uint256 public calls;

    constructor(AgentRitualNFT _nft, MockAgentIdRegistry _registry) {
        nft = _nft;
        registry = _registry;
        signer = vm.addr(SIGNER_PK);
        for (uint256 i = 0; i < 10; i++) {
            actors.push(address(uint160(0x2000 + i)));
        }
    }

    function mintRandom(uint256 seed) external {
        calls++;
        address actor = actors[seed % actors.length];
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = keccak256(abi.encode(seed, calls));
        uint256 pk = (seed % 5 == 0) ? OTHER_PK : SIGNER_PK; // 20% wrong signer
        if (seed % 7 == 0) deadline = block.timestamp - 1; // sometimes expired
        bytes memory sig = _sign(1, actor, deadline, nonce, pk);
        vm.prank(actor);
        try nft.mint(1, actor, deadline, nonce, sig) {} catch {}
    }

    function _sign(uint256 campaignId, address recipient, uint256 deadline, bytes32 nonce, uint256 pk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = nft.voucherDigest(campaignId, recipient, deadline, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}

contract AgentRitualNFTInvariantTest is Test {
    AgentRitualNFT public nft;
    MockAgentIdRegistry public registry;
    MintHandler public handler;

    function setUp() public {
        address signer = vm.addr(0xA11CE5EED);
        registry = new MockAgentIdRegistry();
        nft = new AgentRitualNFT(address(registry), signer, "https://agentritual.test/metadata/");
        // The test contract owns the registry, so it grants the Agent IDs.
        for (uint256 i = 0; i < 10; i++) {
            registry.mint(address(uint160(0x2000 + i)));
        }
        handler = new MintHandler(nft, registry);
        targetContract(address(handler));
    }

    function invariant_TotalSupplyNeverExceeds1000() public view {
        assertLe(nft.totalSupply(), 1000);
        assertLe(nft.mintedPerCampaign(1), 1000);
    }

    function invariant_NoWalletHoldsTwoForCampaign1() public view {
        for (uint256 i = 0; i < 10; i++) {
            address actor = handler.actors(i);
            assertLe(nft.balanceOf(actor), 1);
        }
    }

    /// @notice Proves the handler path actually mints (invariants alone
    ///         would also pass if every attempt reverted).
    function test_HandlerMintsActuallyLand() public {
        for (uint256 i = 0; i < 50; i++) {
            handler.mintRandom(i + 1);
        }
        uint256 supply = nft.totalSupply();
        assertGt(supply, 0, "handler never minted");
        assertLe(supply, 10, "at most one per actor");
        for (uint256 i = 0; i < 10; i++) {
            assertLe(nft.balanceOf(handler.actors(i)), 1);
        }
    }
}
