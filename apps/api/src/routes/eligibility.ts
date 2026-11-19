import type { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import { config } from "../config";
import { getAgentIdBalance } from "../agentId";
import { checkRateLimit, clientIp } from "../rateLimit";

/**
 * GET /api/eligibility?address=0x... — read-only Agent ID check.
 * No DB writes. Returns { address, hasAgentId, registry }.
 * Rate-limited: 60/min per IP (Phase 4).
 */
export function registerEligibilityRoutes(app: FastifyInstance) {
  app.get("/api/eligibility", async (req, reply) => {
    const limit = checkRateLimit(
      {
        capacity: config.rateLimits.eligibilityPerIpPerMin,
        identity: clientIp,
        key: "eligibility:ip",
        windowMs: 60_000,
      },
      req,
    );
    if (!limit.allowed) {
      reply.header("Retry-After", String(limit.retryAfterSeconds));
      return reply.status(429).send({
        error: `rate limit exceeded for eligibility — try again in ${limit.retryAfterSeconds}s`,
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }
    const { address } = (req.query ?? {}) as { address?: unknown };
    if (typeof address !== "string" || !ethers.isAddress(address)) {
      return reply
        .status(400)
        .send({ error: "address must be a valid EVM address" });
    }
    if (!config.agentIdRegistryAddress) {
      return reply.status(503).send({
        error:
          "Agent ID verification not configured: AGENT_ID_REGISTRY_ADDRESS is not set",
      });
    }
    try {
      const balance = await getAgentIdBalance(address);
      return {
        address: address.toLowerCase(),
        hasAgentId: balance > 0n,
        registry: config.agentIdRegistryAddress,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RPC error";
      return reply.status(503).send({
        error: `Agent ID check unavailable: ${msg}`,
      });
    }
  });
}
