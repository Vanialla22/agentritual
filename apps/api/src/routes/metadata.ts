import type { FastifyInstance } from "fastify";
import { config } from "../config";

// Token IDs are globally sequential starting at 0 (audit I-2): Campaign 001
// mints 0–999, later campaigns continue from 1,000. 100,000 covers the
// first 100 campaigns; the route does not check on-chain existence.
const MAX_TOKEN_ID = 100_000;

/**
 * GET /metadata/:id — ERC-721 token metadata for the Genesis Seal.
 * Final artwork ships with the contract (Phase 2); until NFT_IMAGE_URL is
 * set, `image` is null rather than a fake URL.
 */
export function registerMetadataRoutes(app: FastifyInstance) {
  app.get("/metadata/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^\d+$/.test(id)) {
      return reply.status(404).send({ error: "token not found" });
    }
    const tokenId = Number(id);
    if (!Number.isSafeInteger(tokenId) || tokenId < 0 || tokenId >= MAX_TOKEN_ID) {
      return reply.status(404).send({ error: "token not found" });
    }
    return {
      attributes: [
        { trait_type: "Campaign", value: "001 — The Genesis Quest" },
        { trait_type: "Collection", value: "Genesis Seal" },
      ],
      description:
        "AgentRitual Genesis Seal — minted by completing Campaign 001 with a Binance Agent ID. Max supply 1,000, one per wallet.",
      external_url: "",
      image: config.nftImageUrl || null,
      name: `AgentRitual Genesis Seal #${tokenId}`,
      note: "Final Genesis Seal artwork ships with the contract (Phase 2).",
    };
  });
}
