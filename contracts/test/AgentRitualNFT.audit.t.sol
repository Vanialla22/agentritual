// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AgentRitualNFT} from "../src/AgentRitualNFT.sol";
import {MockAgentIdRegistry} from "../src/MockAgentIdRegistry.sol";

/// @notice Independent audit tests for AgentRitualNFT (Phase 2 final audit).
/// @dev Covers the EIP-712 domain-binding gaps in the Phase 2 suite:
///      vouchers signed for a DIFFERENT chainId, vouchers signed for a
///      DIFFERENT verifyingContract, malleable (high-s) signatures, and
///      malformed (short) signatures. All must revert; none may mint.
///      Also asserts the voucher digest binds every struct field.
contract AgentRitualNFTAuditTest is Test {
    AgentRitualNFT public nft;
    MockAgentIdRegistry public registry;

    uint256 internal constant SIGNER_PK = 0xA11CE5EED;
    address internal signer;

    uint256 internal constant CAMPAIGN = 1;
    string internal constant BASE_URI = "https://agentritual.test/metadata/";

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    // secp256k1 curve order (for the malleability test).
    uint256 internal constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        registry = new MockAgentIdRegistry();
        nft = new AgentRitualNFT(address(registry), signer, BASE_URI);
    }

    /// @dev Rebuild an EIP-712 digest for an ARBITRARY domain (chainId /
    ///      verifyingContract), i.e. what a voucher signed "elsewhere"
    ///      would carry. The deployed contract only accepts digests built
    ///      with its own chainId and address.
    function _foreignDigest(
        uint256 campaignId,
        address recipient,
        uint256 deadline,
        bytes32 nonce,
        uint256 chainId,
        address verifyingContract
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("AgentRitual")),
                keccak256(bytes("1")),
                chainId,
                verifyingContract
            )
        );
        bytes32 structHash =
            keccak256(abi.encode(nft.VOUCHER_TYPEHASH(), campaignId, recipient, deadline, nonce));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _signDigest(bytes32 digest, uint256 pk) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ---- (A1) voucher signed for mainnet chainId 56 must not mint on this chain ----

    function test_CrossChainVoucherReverts() public {
        address user = address(0xBEEF);
        registry.mint(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        bytes32 foreignDigest = _foreignDigest(CAMPAIGN, user, deadline, nonce, 56, address(nft));
        assertTrue(foreignDigest != nft.voucherDigest(CAMPAIGN, user, deadline, nonce));
        bytes memory sig = _signDigest(foreignDigest, SIGNER_PK);
        // The address the CONTRACT recovers (its own digest + foreign sig).
        address recovered =
            ECDSA.recover(nft.voucherDigest(CAMPAIGN, user, deadline, nonce), sig);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.InvalidSigner.selector, recovered));
        nft.mint(CAMPAIGN, user, deadline, nonce, sig);
        assertEq(nft.totalSupply(), 0);
    }

    // ---- (A2) voucher signed for a different verifyingContract must not mint ----

    function test_CrossContractVoucherReverts() public {
        address user = address(0xBEEF);
        registry.mint(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        // A second, identical NFT contract at a different address.
        AgentRitualNFT other = new AgentRitualNFT(address(registry), signer, BASE_URI);
        bytes32 foreignDigest =
            _foreignDigest(CAMPAIGN, user, deadline, nonce, block.chainid, address(other));
        assertTrue(foreignDigest != nft.voucherDigest(CAMPAIGN, user, deadline, nonce));
        bytes memory sig = _signDigest(foreignDigest, SIGNER_PK);
        address recovered =
            ECDSA.recover(nft.voucherDigest(CAMPAIGN, user, deadline, nonce), sig);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.InvalidSigner.selector, recovered));
        nft.mint(CAMPAIGN, user, deadline, nonce, sig);
        assertEq(nft.totalSupply(), 0);
    }

    // ---- (A3) malleable (high-s) signature must revert, not mint ----

    function test_MalleableSignatureReverts() public {
        address user = address(0xBEEF);
        registry.mint(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        bytes32 digest = nft.voucherDigest(CAMPAIGN, user, deadline, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, digest);
        // Flip s to its high-s mirror and toggle v: same signer, malleable sig.
        bytes32 sPrime = bytes32(SECP256K1_N - uint256(s));
        uint8 vPrime = v == 27 ? 28 : 27;
        bytes memory malleableSig = abi.encodePacked(r, sPrime, vPrime);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureS.selector, sPrime));
        nft.mint(CAMPAIGN, user, deadline, nonce, malleableSig);
        assertEq(nft.totalSupply(), 0);
    }

    // ---- (A4) malformed 64-byte signature must revert ----
    // OpenZeppelin v5.7 ECDSA.recover accepts ONLY 65-byte signatures;
    // a 64-byte input reverts ECDSAInvalidSignatureLength(64) (EIP-2098
    // compact signatures are NOT supported in this version).

    function test_ShortSignatureReverts() public {
        address user = address(0xBEEF);
        registry.mint(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        bytes memory shortSig = new bytes(64);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 64));
        nft.mint(CAMPAIGN, user, deadline, nonce, shortSig);
        assertEq(nft.totalSupply(), 0);
    }

    // ---- (A5) empty signature must revert ----

    function test_EmptySignatureReverts() public {
        address user = address(0xBEEF);
        registry.mint(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 0));
        nft.mint(CAMPAIGN, user, deadline, nonce, "");
        assertEq(nft.totalSupply(), 0);
    }

    // ---- (A6) digest binds every voucher field ----

    function test_VoucherDigestBindsAllFields() public view {
        address user = address(0xBEEF);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));
        bytes32 base = nft.voucherDigest(CAMPAIGN, user, deadline, nonce);

        assertTrue(base != nft.voucherDigest(2, user, deadline, nonce)); // campaignId
        assertTrue(base != nft.voucherDigest(CAMPAIGN, address(0xCAFE), deadline, nonce)); // recipient
        assertTrue(base != nft.voucherDigest(CAMPAIGN, user, deadline + 1, nonce)); // deadline
        assertTrue(base != nft.voucherDigest(CAMPAIGN, user, deadline, bytes32(uint256(2)))); // nonce
    }

    // ---- (A7) campaign 0 is mintable only with a valid voucher (no free mint) ----

    function test_CampaignZeroStillNeedsVoucher() public {
        address user = address(0xBEEF);
        registry.mint(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));
        // No valid signature: signing with a wrong key must fail.
        bytes32 digest = nft.voucherDigest(0, user, deadline, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD5EED, digest);
        bytes memory sig = abi.encodePacked(r, s, v);
        address recovered = ECDSA.recover(digest, sig);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.InvalidSigner.selector, recovered));
        nft.mint(0, user, deadline, nonce, sig);
        assertEq(nft.totalSupply(), 0);
    }

    // ---- (A8) owner has NO mint path: transferOwnership does not create one ----

    function test_OwnerCannotMintWithoutVoucher() public {
        address user = address(0xBEEF);
        registry.mint(user);
        // The owner is this test contract; there is no owner-only mint
        // function to call. The only mint entry point is mint(), which
        // requires a valid voucher even for the owner.
        uint256 deadline = block.timestamp + 1 days;
        bytes32 nonce = bytes32(uint256(1));
        bytes memory sig = _signDigest(nft.voucherDigest(CAMPAIGN, user, deadline, nonce), 0xBAD5EED);
        address recovered =
            ECDSA.recover(nft.voucherDigest(CAMPAIGN, user, deadline, nonce), sig);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentRitualNFT.InvalidSigner.selector, recovered));
        nft.mint(CAMPAIGN, user, deadline, nonce, sig);
        assertEq(nft.totalSupply(), 0);
    }
}
