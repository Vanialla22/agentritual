import type { FastifyInstance } from "fastify";
import { ethers, type EventLog } from "ethers";
import { config } from "../config";

const NFT_ABI = [
  "function totalSupply() view returns (uint256)",
  "function MAX_SUPPLY_PER_CAMPAIGN() view returns (uint256)",
  // Real event (AgentRitualNFT.sol): Mint(uint256 indexed campaignId,
  // uint256 indexed tokenId, address indexed recipient). An earlier
  // draft used a wrong (minter, tokenId) shape and misread args[0].
  "event Mint(uint256 indexed campaignId, uint256 indexed tokenId, address indexed recipient)",
];

const MAX_SUPPLY_FALLBACK = 1000;
const EVENT_WINDOW_BLOCKS = 5000;

/**
 * GET /api/tracker — reads live state from the NFT contract.
 *
 * Honest failure modes (no invented numbers, ever):
 * - 503 when the contract is not deployed/configured yet.
 * - 503 when the RPC call fails.
 */
export function registerTrackerRoutes(app: FastifyInstance) {
  app.get("/api/tracker", async (_req, reply) => {
    if (!config.nftContractAddress) {
      return reply.status(503).send({
        error:
          "tracker not configured: NFT contract not deployed yet",
      });
    }
    try {
      const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
      const contract = new ethers.Contract(
        config.nftContractAddress,
        NFT_ABI,
        provider,
      );
      const [totalSupply, latestBlock] = await Promise.all([
        contract.totalSupply() as Promise<bigint>,
        provider.getBlockNumber(),
      ]);
      let maxSupply = BigInt(MAX_SUPPLY_FALLBACK);
      try {
        maxSupply = (await contract.MAX_SUPPLY_PER_CAMPAIGN()) as bigint;
      } catch {
        // Contract without MAX_SUPPLY_PER_CAMPAIGN() — fall back to the documented cap.
      }
      const fromBlock = Math.max(0, latestBlock - EVENT_WINDOW_BLOCKS);
      const events = (await contract.queryFilter(
        contract.filters.Mint,
        fromBlock,
        latestBlock,
      )) as EventLog[];
      const recentMints = await Promise.all(
        events.slice(-20).reverse().map(async (ev) => {
          const block = await ev.getBlock();
          return {
            blockNumber: ev.blockNumber,
            // Event args: [0] campaignId, [1] tokenId, [2] recipient.
            minter: (ev.args?.[2] as string) ?? "",
            timestamp: block
              ? new Date(block.timestamp * 1000).toISOString()
              : null,
            tokenId: Number(ev.args?.[1] as bigint),
            txHash: ev.transactionHash,
          };
        }),
      );
      const total = Number(totalSupply);
      const max = Number(maxSupply);
      return {
        chainId: config.chainId,
        chainName:
          config.chainId === 56
            ? "BNB Smart Chain"
            : "BNB Smart Chain Testnet",
        contractAddress: config.nftContractAddress,
        maxSupply: max,
        recentMints,
        remaining: Math.max(0, max - total),
        totalSupply: total,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RPC error";
      return reply.status(503).send({
        error: `tracker unavailable: ${msg}`,
      });
    }
  });
}
