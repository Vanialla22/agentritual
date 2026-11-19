// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title AgentRitualNFT — "AgentRitual Genesis Seal"
/// @notice ERC-721 for Campaign 001 of the AgentRitual platform
///         (Binance Agent ID Hackathon). Minting is voucher-gated: a
///         project-admin-signed EIP-712 ClaimVoucher is required.
/// @dev Hard rules enforced by this contract — there is NO admin bypass:
///      - max 1,000 NFTs per campaign
///      - one mint per wallet per campaign
///      - voucher single-use + expiry; replay is rejected
///      - voucher recipient == msg.sender == Agent ID owner wallet
///        (the "three addresses must match" rule)
///      - minter must hold an Agent ID (balanceOf > 0 on the registry)
///      There is NO admin-mint function and NO cap-raising function.
///      Token IDs are globally sequential starting at 0: Campaign 001
///      mints ids 0-999 (matching the API metadata range). A per-campaign
///      counter was considered and rejected — it would collide token IDs
///      across campaigns (proven by test_OneMintPerWalletPerCampaign).
/// @dev Ownership is two-step (audit L-2, Phase 5 prep): transferOwnership
///      only sets a pending owner; the new owner must call
///      acceptOwnership() before any admin power moves. A mistaken
///      transfer is recoverable — the old owner stays owner until accept.
contract AgentRitualNFT is ERC721, EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY_PER_CAMPAIGN = 1000;

    bytes32 public constant VOUCHER_TYPEHASH =
        keccak256("ClaimVoucher(uint256 campaignId,address recipient,uint256 deadline,bytes32 nonce)");

    IERC721 public immutable agentIdRegistry;
    address public authorizedSigner;
    string private _baseTokenURI;

    /// @dev Number of tokens minted per campaign (also the next token ID).
    mapping(uint256 campaignId => uint256 minted) public mintedPerCampaign;
    /// @dev One mint per wallet per campaign.
    mapping(uint256 campaignId => mapping(address wallet => bool minted)) public hasMinted;
    /// @dev Replay protection: EIP-712 voucher digest -> already used.
    mapping(bytes32 voucherDigest => bool used) public usedVouchers;

    uint256 private _totalMinted;

    event Mint(uint256 indexed campaignId, uint256 indexed tokenId, address indexed recipient);
    event AuthorizedSignerSet(address indexed oldSigner, address indexed newSigner);
    event BaseURISet(string baseURI);

    error VoucherExpired(uint256 deadline);
    error VoucherAlreadyUsed(bytes32 voucherDigest);
    error InvalidSigner(address recovered);
    error RecipientMismatch(address recipient, address caller);
    error NoAgentId(address caller);
    error CampaignSoldOut(uint256 campaignId);
    error AlreadyMinted(uint256 campaignId, address caller);

    constructor(address _agentIdRegistry, address _authorizedSigner, string memory baseURI_)
        ERC721("AgentRitual Genesis Seal", "ARSEAL")
        EIP712("AgentRitual", "1")
        Ownable(msg.sender)
    {
        require(_agentIdRegistry != address(0), "registry zero");
        require(_authorizedSigner != address(0), "signer zero");
        agentIdRegistry = IERC721(_agentIdRegistry);
        authorizedSigner = _authorizedSigner;
        _baseTokenURI = baseURI_;
    }

    /// @notice Total number of tokens minted across all campaigns.
    function totalSupply() external view returns (uint256) {
        return _totalMinted;
    }

    /// @notice EIP-712 digest for a voucher — the exact digest `mint`
    ///         verifies. Off-chain signers (backend, agents) use this.
    function voucherDigest(uint256 campaignId, address recipient, uint256 deadline, bytes32 nonce)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(abi.encode(VOUCHER_TYPEHASH, campaignId, recipient, deadline, nonce))
        );
    }

    /// @notice Mint one Genesis Seal with a signed claim voucher.
    /// @dev Checks follow the audited order: paused -> expiry -> voucher
    ///      unused -> signer -> recipient == msg.sender -> voucher marked
    ///      used BEFORE any external call (registry balanceOf, _safeMint
    ///      callback) -> Agent ID gate -> cap -> one-per-wallet.
    function mint(uint256 campaignId, address recipient, uint256 deadline, bytes32 nonce, bytes calldata signature)
        external
        whenNotPaused
        nonReentrant
    {
        if (block.timestamp > deadline) revert VoucherExpired(deadline);
        bytes32 digest = voucherDigest(campaignId, recipient, deadline, nonce);
        if (usedVouchers[digest]) revert VoucherAlreadyUsed(digest);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != authorizedSigner) revert InvalidSigner(recovered);
        if (recipient != msg.sender) revert RecipientMismatch(recipient, msg.sender);
        // Mark the voucher used BEFORE any external call.
        usedVouchers[digest] = true;
        if (agentIdRegistry.balanceOf(msg.sender) == 0) revert NoAgentId(msg.sender);
        if (mintedPerCampaign[campaignId] >= MAX_SUPPLY_PER_CAMPAIGN) revert CampaignSoldOut(campaignId);
        if (hasMinted[campaignId][msg.sender]) revert AlreadyMinted(campaignId, msg.sender);
        hasMinted[campaignId][msg.sender] = true;
        uint256 tokenId = _totalMinted;
        mintedPerCampaign[campaignId] += 1;
        _totalMinted += 1;
        _safeMint(recipient, tokenId);
        emit Mint(campaignId, tokenId, recipient);
    }

    // ---- Owner functions (see docs/admin-rights.md) ----
    // Owner CAN: rotate the authorized signer, change baseURI, pause/unpause.
    // Owner CANNOT: mint for anyone, raise the 1,000 cap, bypass
    // one-per-wallet, move a voucher, or change tracker numbers.
    // Those powers do not exist in this contract.

    function setAuthorizedSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "signer zero");
        address oldSigner = authorizedSigner;
        authorizedSigner = newSigner;
        emit AuthorizedSignerSet(oldSigner, newSigner);
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
