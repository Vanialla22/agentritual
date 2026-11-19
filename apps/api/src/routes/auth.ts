import type { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import { config } from "../config";
import {
  buildChallenge,
  challengeTag,
  createProofToken,
  parseChallengeMessage,
  verifyChallengeTag,
} from "../auth";
import { checkRateLimit, clientIp } from "../rateLimit";

/**
 * Wallet-ownership proof (Phase 4, backlog item 1).
 *
 * GET  /api/auth/challenge?address=0x... → {address, message, expiresAt, tag}
 * POST /api/auth/verify {address, message, tag, signature} → {proofToken}
 *
 * The challenge is a plain-text EIP-191 statement with a random nonce and
 * a 10-minute expiry. It is stateless: the tag is an HMAC over the
 * challenge fields, so the server needs no DB table. The user signs the
 * message with their own wallet (personal_sign) — signing a message is
 * not sharing a private key, and the message authorizes nothing.
 *
 * NOTE for BAW-driven agents: BAW CLI `sign-message` is EIP-712-only,
 * so it cannot personal-sign this challenge. Sign it with the agent's
 * own personal-sign capability (ethers/cast/AI Pro) instead.
 */
export function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/auth/challenge", async (req, reply) => {
    const { address } = (req.query ?? {}) as { address?: unknown };
    if (typeof address !== "string" || !ethers.isAddress(address)) {
      return reply
        .status(400)
        .send({ error: "address must be a valid EVM address" });
    }
    if (!config.authSecret) {
      return reply.status(503).send({
        error:
          "ownership proof not configured: AUTH_SECRET (or ADMIN_SESSION_SECRET) is not set",
      });
    }
    const limit = checkRateLimit(
      {
        capacity: config.rateLimits.challengePerIpPerMin,
        identity: clientIp,
        key: "challenge:ip",
        windowMs: 60_000,
      },
      req,
    );
    if (!limit.allowed) {
      reply.header("Retry-After", String(limit.retryAfterSeconds));
      return reply.status(429).send({
        error: `rate limit exceeded for challenge — try again in ${limit.retryAfterSeconds}s`,
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }
    const challenge = buildChallenge(address);
    return {
      address: challenge.address,
      expiresAt: challenge.expiresAt,
      message: challenge.message,
      tag: challengeTag(challenge),
    };
  });

  app.post("/api/auth/verify", async (req, reply) => {
    const body = (req.body ?? {}) as {
      address?: unknown;
      message?: unknown;
      tag?: unknown;
      signature?: unknown;
    };
    const address =
      typeof body.address === "string" ? body.address.trim() : "";
    const message =
      typeof body.message === "string" ? body.message : "";
    const tag = typeof body.tag === "string" ? body.tag : "";
    const signature =
      typeof body.signature === "string" ? body.signature.trim() : "";
    if (!ethers.isAddress(address) || !message || !tag || !signature) {
      return reply.status(400).send({
        error: "address, message, tag and signature are required",
      });
    }
    if (!config.authSecret) {
      return reply.status(503).send({
        error: "ownership proof not configured",
      });
    }
    const parsed = parseChallengeMessage(message);
    if (!parsed || parsed.address !== address.toLowerCase()) {
      return reply.status(400).send({
        error: "challenge message does not match the address",
      });
    }
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      return reply
        .status(400)
        .send({ error: "challenge expired — request a new one" });
    }
    if (!verifyChallengeTag(parsed, tag)) {
      return reply
        .status(400)
        .send({ error: "challenge tag invalid — request a new challenge" });
    }
    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      return reply
        .status(400)
        .send({ error: "signature is not a valid ECDSA signature" });
    }
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return reply.status(403).send({
        error: "signature does not match the address — proof failed",
      });
    }
    const proofToken = createProofToken(address);
    if (!proofToken) {
      return reply.status(503).send({
        error: "ownership proof not configured",
      });
    }
    return { address: address.toLowerCase(), proofToken };
  });
}
