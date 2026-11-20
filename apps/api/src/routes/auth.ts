import type { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import { config } from "../config";
import type { Db } from "../db";
import {
  buildChallenge,
  buildChallengeTypedData,
  challengeTag,
  consumeChallenge,
  createProofToken,
  parseChallengeMessage,
  verifyChallengeTag,
} from "../auth";
import { checkRateLimit, clientIp } from "../rateLimit";

/**
 * Wallet-ownership proof (Phase 4, backlog item 1).
 *
 * GET  /api/auth/challenge?address=0x... → {address, message, expiresAt, tag, typedData?}
 * POST /api/auth/verify {address, message, tag, signature, signType?} → {proofToken}
 *
 * The challenge is a plain-text EIP-191 statement with a random nonce and
 * a 10-minute expiry. It is stateless: the tag is an HMAC over the
 * challenge fields, so the server needs no DB table. The user signs the
 * message with their own wallet (personal_sign) — signing a message is
 * not sharing a private key, and the message authorizes nothing.
 *
 * EIP-712 variant (BAW agents): BAW CLI `sign-message` is EIP-712-only,
 * so it cannot personal_sign this challenge. The challenge response also
 * carries `typedData` (same nonce + expiry + wallet, domain from server
 * config). A BAW agent signs that typed data (eth_signTypedData_v4) and
 * verifies with `signType: "eip712"`. Both signature types go through
 * the identical expiry, tag, and single-use checks — only the recovery
 * step differs.
 */
export function registerAuthRoutes(app: FastifyInstance, db: Db) {
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
      // EIP-712 variant for BAW agents (omitted when the NFT contract
      // is unconfigured — the text challenge still works on its own).
      typedData: buildChallengeTypedData(challenge) ?? undefined,
    };
  });

  app.post("/api/auth/verify", async (req, reply) => {
    const body = (req.body ?? {}) as {
      address?: unknown;
      message?: unknown;
      tag?: unknown;
      signature?: unknown;
      signType?: unknown;
    };
    const address =
      typeof body.address === "string" ? body.address.trim() : "";
    const message =
      typeof body.message === "string" ? body.message : "";
    const tag = typeof body.tag === "string" ? body.tag : "";
    const signature =
      typeof body.signature === "string" ? body.signature.trim() : "";
    // "eip191" (default, personal_sign) or "eip712" (BAW agents).
    // Anything else is rejected — the server never guesses how a
    // signature was made.
    const signType =
      typeof body.signType === "string" ? body.signType.trim() : "eip191";
    if (signType !== "eip191" && signType !== "eip712") {
      return reply.status(400).send({
        error: 'signType must be "eip191" or "eip712"',
      });
    }
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
      if (signType === "eip712") {
        // The typed data is rebuilt from the parsed challenge fields
        // with the domain from server config — the client never supplies
        // domain values, so a signature for another chain or contract
        // cannot verify here.
        const typedData = buildChallengeTypedData(parsed);
        if (!typedData) {
          return reply.status(503).send({
            error:
              "EIP-712 challenge not configured: NFT_CONTRACT_ADDRESS is not set",
          });
        }
        recovered = ethers.verifyTypedData(
          typedData.domain,
          typedData.types,
          typedData.message,
          signature,
        );
      } else {
        recovered = ethers.verifyMessage(message, signature);
      }
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
    // Single-use (hardening review H-1): a challenge nonce verifies
    // exactly once. The UNIQUE constraint on used_challenges.nonce is
    // the atomic guard, so two concurrent verifies cannot both succeed.
    // Consumed only AFTER the signature checks out, so a failed verify
    // does not burn the challenge.
    const consumed = await consumeChallenge(db, parsed.nonce, address);
    if (!consumed) {
      return reply.status(400).send({
        error: "challenge already used — request a new one",
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
