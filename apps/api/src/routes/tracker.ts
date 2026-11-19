import type { FastifyInstance } from "fastify";
import { ethers, type EventLog } from "ethers";
import { config } from "../config";

const NFT_ABI = [
  "function totalSupply() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "event Mint(address indexed minter, uint256 indexed tokenId)",
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
        maxSupply = (await contract.MAX_SUPPLY()) as bigint;
      } catch {
        // Contract without MAX_SUPPLY() — fall back to the documented cap.
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
            minter: (ev.args?.[0] as string) ?? "",
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
        chainId: 56,
        chainName: "BNB Smart Chain",
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
