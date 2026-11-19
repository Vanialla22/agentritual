// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice TEST-ONLY mock of the SPACE ID Agent ID registry.
/// @dev NEVER deploy this on mainnet. On mainnet the AgentRitualNFT
///      constructor receives the real registry at
///      0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F.
///      This mock exists only because the real registry is NOT deployed
///      on BSC testnet (chain 97). It exposes the same
///      `balanceOf(address)` interface the NFT contract gates on, so the
///      gate logic is identical in test and production.
contract MockAgentIdRegistry is ERC721, Ownable {
    uint256 private _nextId;

    constructor() ERC721("Mock Agent ID", "MOCKAI") Ownable(msg.sender) {}

    /// @notice Grant an Agent ID to `to`. Owner-only (test setup only).
    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextId++;
        _safeMint(to, tokenId);
    }
}
