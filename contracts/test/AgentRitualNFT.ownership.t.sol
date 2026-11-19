// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRitualNFT} from "../src/AgentRitualNFT.sol";
import {MockAgentIdRegistry} from "../src/MockAgentIdRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Ownable2Step tests (Phase 5 prep — audit L-2).
/// @dev The contract moved from OZ Ownable to OZ Ownable2Step (5.7.0).
///      transferOwnership must NOT move admin powers by itself: the new
///      owner has to call acceptOwnership(). A mistaken transfer is
///      recoverable — the old owner stays owner until accept, and can
///      cancel the pending transfer by transferring to address(0).
contract AgentRitualNFTOwnershipTest is Test {
    AgentRitualNFT public nft;
    MockAgentIdRegistry public registry;

    uint256 internal constant SIGNER_PK = 0xA11CE5EED; // fixed test key only
    address internal signer;

    address internal constant NEW_OWNER = address(0xBEEF);
    address internal constant STRANGER = address(0xCAFE);

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        registry = new MockAgentIdRegistry();
        nft = new AgentRitualNFT(address(registry), signer, "https://agentritual.test/metadata/");
    }

    function test_TransferOwnershipSetsPendingOwnerOnly() public {
        assertEq(nft.owner(), address(this));

        nft.transferOwnership(NEW_OWNER);

        assertEq(nft.pendingOwner(), NEW_OWNER);
        // Owner is UNCHANGED until the new owner accepts.
        assertEq(nft.owner(), address(this));
    }

    function test_OnlyPendingOwnerCanAcceptOwnership() public {
        nft.transferOwnership(NEW_OWNER);

        // A stranger (not the pending owner) cannot accept.
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, STRANGER));
        nft.acceptOwnership();
        assertEq(nft.owner(), address(this));

        // The old owner cannot accept for the new owner either.
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this))
        );
        nft.acceptOwnership();
        assertEq(nft.owner(), address(this));

        // The pending owner accepts: ownership moves, pending cleared.
        vm.prank(NEW_OWNER);
        nft.acceptOwnership();
        assertEq(nft.owner(), NEW_OWNER);
        assertEq(nft.pendingOwner(), address(0));
    }

    function test_AfterAcceptNewOwnerHasAdminPowersOldOwnerDoesNot() public {
        nft.transferOwnership(NEW_OWNER);
        vm.prank(NEW_OWNER);
        nft.acceptOwnership();

        // New owner can rotate the signer.
        address newSigner = address(0x5EED);
        vm.prank(NEW_OWNER);
        nft.setAuthorizedSigner(newSigner);
        assertEq(nft.authorizedSigner(), newSigner);

        // Old owner can no longer do any admin action.
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this))
        );
        nft.setAuthorizedSigner(signer);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this))
        );
        nft.pause();
    }

    function test_PendingTransferCanBeCancelled() public {
        nft.transferOwnership(NEW_OWNER);
        assertEq(nft.pendingOwner(), NEW_OWNER);

        // Transfer to address(0) cancels the pending transfer (OZ behavior).
        nft.transferOwnership(address(0));
        assertEq(nft.pendingOwner(), address(0));

        // The would-be new owner can no longer accept.
        vm.prank(NEW_OWNER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, NEW_OWNER));
        nft.acceptOwnership();
        assertEq(nft.owner(), address(this));
    }

    function test_RenounceOwnershipStillWorks() public {
        nft.renounceOwnership();
        assertEq(nft.owner(), address(0));
        assertEq(nft.pendingOwner(), address(0));

        // Nobody has admin powers anymore (old owner included).
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this))
        );
        nft.setAuthorizedSigner(signer);
    }
}
