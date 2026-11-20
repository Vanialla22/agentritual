import { ethers } from "ethers";
import { config } from "./config";

const NFT_ABI = ["function hasMinted(uint256,address) view returns (bool)"];

/**
 * Read-only one-mint check (21 Nov 2026, resubmit fix): has `wallet`
 * already minted for `campaignId` on the NFT contract? The contract
 * enforces one mint per wallet per campaign on-chain (hasMinted
 * mapping); this read lets the API refuse a second submission early
 * (409) instead of issuing a voucher whose mint must revert.
 *
 * Fail-closed: throws when the contract is not configured or the RPC
 * call fails. Callers translate that into HTTP 503 — never silently
 * skip the check.
 */
export async function hasMinted(
  campaignId: number,
  wallet: string,
): Promise<boolean> {
  if (!config.nftContractAddress) {
    throw new Error("NFT contract not configured");
  }
  const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
  const nft = new ethers.Contract(config.nftContractAddress, NFT_ABI, provider);
  return (await nft.hasMinted(campaignId, wallet)) as boolean;
}
