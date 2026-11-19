// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRitualNFT} from "../src/AgentRitualNFT.sol";
import {MockAgentIdRegistry} from "../src/MockAgentIdRegistry.sol";

/// @notice Unit + fuzz tests for AgentRitualNFT (Phase 2).
/// @dev Every required property from the Phase 2 spec is covered:
///      happy path, 1,000 cap, one-per-wallet, expiry, replay,
///      three-address match, wrong signer, no Agent ID, pause,
///      signer rotation, plus fuzz (random signatures never mint).
contract AgentRitualNFTTest is Test {
    AgentRitualNFT public nft;
    MockAgentIdRegistry public registry;

    uint256 internal constant SIGNER_PK = 0xA11CE5EED; // fixed test key only
    uint256 internal constant OTHER_PK = 0xBAD5EED;
    address internal signer;
    address internal otherSigner;

    uint256 internal constant CAMPAIGN = 1;
    string internal constant BASE_URI = "https://agentritual.test/metadata/";

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        otherSigner = vm.addr(OTHER_PK);
        registry = new MockAgentIdRegistry();
        nft = new AgentRitualNFT(address(registry), signer, BASE_URI);
    }

    // ---- helpers ----

    function _sign(uint256 campaignId, address recipient, uint256 deadline, bytes32 nonce, uint256 pk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = nft.voucherDigest(campaignId, recipient, deadline, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _grant(address to) internal {
        registry.mint(to);
    }

    /// @dev Mint once as `user` with a fresh voucher signed by SIGNER_PK.
    function _mintAs(address user, uint256 campaignId, uint256 deadline, bytes32 nonce) internal {
        bytes memory sig = _sign(campaignId, user, deadline, nonce, SIGNER_PK);
        vm.prank(user);
        nft.mint(campaignId, user, deadline, nonce, sig);
    }

    // ---- (1) happy path ----

    function test_HappyPathMint() public {
        address user = address(0xBEEF);
        _grant(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        _mintAs(user, CAMPAIGN, deadline, nonce);

        assertEq(nft.ownerOf(0), user);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.mintedPerCampaign(CAMPAIGN), 1);
        assertEq(nft.balanceOf(user), 1);
        assertEq(nft.tokenURI(0), string.concat(BASE_URI, "0"));
        assertTrue(nft.hasMinted(CAMPAIGN, user));
    }

    // ---- (2) cap 1,000 ----

    function test_Cap1000Enforced() public {
        uint256 deadline = block.timestamp + 1 days;
        for (uint256 i = 0; i < 1000; i++) {
            address user = address(uint160(0x1000 + i));
            _grant(user);
            _mintAs(user, CAMPAIGN, deadline, bytes32(i + 1));
        }
        assertEq(nft.totalSupply(), 1000);
        assertEq(nft.mintedPerCampaign(CAMPAIGN), 1000);

        address late = address(0xCAFE);
        _grant(late);
        bytes memory sig = _sign(CAMPAIGN, late, deadline, bytes32(uint256(1001)), SIGNER_PK);
        vm.prank(late);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.CampaignSoldOut.selector, CAMPAIGN));
        nft.mint(CAMPAIGN, late, deadline, bytes32(uint256(1001)), sig);
        assertEq(nft.totalSupply(), 1000);
    }

    // ---- (3) one mint per wallet per campaign ----

    function test_OneMintPerWalletPerCampaign() public {
        address user = address(0xBEEF);
        _grant(user);
        uint256 deadline = block.timestamp + 1 days;

        _mintAs(user, CAMPAIGN, deadline, bytes32(uint256(1)));

        // Fresh valid voucher, same wallet, same campaign -> must revert.
        bytes memory sig2 = _sign(CAMPAIGN, user, deadline, bytes32(uint256(2)), SIGNER_PK);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.AlreadyMinted.selector, CAMPAIGN, user));
        nft.mint(CAMPAIGN, user, deadline, bytes32(uint256(2)), sig2);

        // Same wallet CAN mint a different campaign.
        _mintAs(user, 2, deadline, bytes32(uint256(3)));
        assertEq(nft.balanceOf(user), 2);
    }

    // ---- (4) expired voucher ----

    function test_ExpiredVoucherReverts() public {
        address user = address(0xBEEF);
        _grant(user);
        uint256 deadline = block.timestamp - 1; // already past
        bytes memory sig = _sign(CAMPAIGN, user, deadline, bytes32(uint256(1)), SIGNER_PK);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.VoucherExpired.selector, deadline));
        nft.mint(CAMPAIGN, user, deadline, bytes32(uint256(1)), sig);
    }

    // ---- (5) replay ----

    function test_ReplayReverts() public {
        address user = address(0xBEEF);
        _grant(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        _mintAs(user, CAMPAIGN, deadline, nonce);

        // Same voucher bytes again (different wallet cannot replay it either,
        // because recipient == msg.sender is enforced, so replay by the same
        // wallet is the meaningful case).
        bytes memory sig = _sign(CAMPAIGN, user, deadline, nonce, SIGNER_PK);
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentRitualNFT.VoucherAlreadyUsed.selector, nft.voucherDigest(CAMPAIGN, user, deadline, nonce)
            )
        );
        nft.mint(CAMPAIGN, user, deadline, nonce, sig);
    }

    // ---- (6) three-address match ----

    function test_ThreeAddressMatchReverts() public {
        address alice = address(0xA11CE);
        address bob = address(0xB0B);
        _grant(alice);
        _grant(bob);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        // Voucher signed for Alice, executed by Bob -> must revert.
        bytes memory sig = _sign(CAMPAIGN, alice, deadline, nonce, SIGNER_PK);
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRitualNFT.RecipientMismatch.selector, alice, bob)
        );
        nft.mint(CAMPAIGN, alice, deadline, nonce, sig);
        assertEq(nft.totalSupply(), 0);
    }

    // ---- (7) wrong signer ----

    function test_WrongSignerReverts() public {
        address user = address(0xBEEF);
        _grant(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        // Voucher signed by a key that is NOT the authorized signer.
        bytes memory sig = _sign(CAMPAIGN, user, deadline, nonce, OTHER_PK);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.InvalidSigner.selector, otherSigner));
        nft.mint(CAMPAIGN, user, deadline, nonce, sig);
        assertEq(nft.totalSupply(), 0);
    }

    // ---- (8) no Agent ID ----

    function test_NoAgentIdReverts() public {
        address user = address(0xBEEF); // never granted a mock Agent ID
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));
        bytes memory sig = _sign(CAMPAIGN, user, deadline, nonce, SIGNER_PK);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.NoAgentId.selector, user));
        nft.mint(CAMPAIGN, user, deadline, nonce, sig);
    }

    // ---- (9) pause ----

    function test_PauseBlocksMint() public {
        address user = address(0xBEEF);
        _grant(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        nft.pause();
        bytes memory sig = _sign(CAMPAIGN, user, deadline, nonce, SIGNER_PK);
        vm.prank(user);
        vm.expectRevert(); // Pausable.EnforcedPause
        nft.mint(CAMPAIGN, user, deadline, nonce, sig);

        nft.unpause();
        _mintAs(user, CAMPAIGN, deadline, nonce);
        assertEq(nft.totalSupply(), 1);
    }

    // ---- (10) signer rotation ----

    function test_SignerRotation() public {
        address user = address(0xBEEF);
        address user2 = address(0xCAFE);
        _grant(user);
        _grant(user2);
        uint256 deadline = block.timestamp + 1 days;

        // Rotate to the other key.
        nft.setAuthorizedSigner(otherSigner);
        assertEq(nft.authorizedSigner(), otherSigner);

        // Old signer's voucher now fails.
        bytes memory oldSig = _sign(CAMPAIGN, user, deadline, bytes32(uint256(1)), SIGNER_PK);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.InvalidSigner.selector, signer));
        nft.mint(CAMPAIGN, user, deadline, bytes32(uint256(1)), oldSig);

        // New signer's voucher works.
        bytes memory newSig = _sign(CAMPAIGN, user2, deadline, bytes32(uint256(2)), OTHER_PK);
        vm.prank(user2);
        nft.mint(CAMPAIGN, user2, deadline, bytes32(uint256(2)), newSig);
        assertEq(nft.ownerOf(0), user2);
    }

    // ---- fuzz: random signatures must never mint ----

    function testFuzz_RandomSignatureNeverMints(bytes calldata sig, address user, uint256 deadlineOffset)
        public
    {
        vm.assume(user != address(0));
        vm.assume(sig.length > 0);
        uint256 deadline = block.timestamp + bound(deadlineOffset, 1, 7 days);
        bytes32 nonce = keccak256(abi.encode(sig, user, deadlineOffset));
        _grant(user);
        vm.prank(user);
        vm.expectRevert();
        nft.mint(CAMPAIGN, user, deadline, nonce, sig);
        assertEq(nft.totalSupply(), 0);
    }

    // ---- fuzz: valid vouchers with random fields mint exactly once ----

    function testFuzz_ValidVoucherMints(uint256 campaignSeed, uint256 deadlineOffset, bytes32 nonce) public {
        uint256 campaignId = bound(campaignSeed, 1, 5);
        uint256 deadline = block.timestamp + bound(deadlineOffset, 1, 30 days);
        address user = address(uint160(bound(uint256(nonce), 1, type(uint160).max)));
        vm.assume(user != address(0));
        _grant(user);
        _mintAs(user, campaignId, deadline, nonce);
        assertEq(nft.ownerOf(0), user);
        assertEq(nft.totalSupply(), 1);
        assertTrue(nft.hasMinted(campaignId, user));
    }
}
