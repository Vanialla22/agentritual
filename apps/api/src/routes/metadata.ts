import type { FastifyInstance } from "fastify";
import { config, isAuthorizedCampaign } from "../config";

// Token IDs are globally sequential starting at 0 (audit I-2): Campaign 001
// mints 0–999, later campaigns continue from 1,000. The campaign for a
// token is floor(tokenId / 1000) + 1. Only authorized campaigns return
// metadata — a token from an unauthorized campaign 404s instead of
// returning another campaign's attributes (hardening review H-6).
const MAX_TOKEN_ID = 100_000;

/**
 * GET /metadata/:id — ERC-721 token metadata for the Genesis Seal.
 * Final artwork is pinned to IPFS for the mainnet launch; until NFT_IMAGE_URL is
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
    const campaignId = String(Math.floor(tokenId / 1000) + 1).padStart(3, "0");
    if (!isAuthorizedCampaign(campaignId)) {
      return reply.status(404).send({ error: "token not found" });
    }
    return {
      attributes: [
        { trait_type: "Campaign", value: `${campaignId} — The Genesis Quest` },
        { trait_type: "Collection", value: "Genesis Seal" },
      ],
      description:
        `AgentRitual Genesis Seal — minted by completing Campaign ${campaignId} with a Binance Agent ID. Max supply 1,000, one per wallet.`,
      external_url: "",
      image: config.nftImageUrl || null,
      name: `AgentRitual Genesis Seal #${tokenId}`,
      note: "Final Genesis Seal metadata, pinned to IPFS for the mainnet launch (Campaign 001).",
    };
  });
}
