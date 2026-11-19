import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import type { Db } from "../db";
import { getAgentIdBalance } from "../agentId";
import { verifyProofToken } from "../auth";
import { appendAuditLog } from "../auditLog";
import { checkRateLimit, clientIp } from "../rateLimit";
import { config } from "../config";

export interface SubmissionRow {
  id: string;
  wallet: string;
  square_url: string;
  campaign_id: string;
  status: string;
  created_at: string;
  review_note: string | null;
  reviewed_at: string | null;
}

interface VoucherRow {
  deadline: number;
  nonce: string;
  recipient: string;
  signature: string;
}

/** A Square post URL must be on binance.com under /square/post/<id>. */
export const SQUARE_URL_RE =
  /^https:\/\/(www\.)?binance\.com\/square\/post\/[A-Za-z0-9_-]+\/?$/;

export function registerSubmissionRoutes(app: FastifyInstance, db: Db) {
  app.post("/api/submissions", async (req, reply) => {
    const body = (req.body ?? {}) as {
      wallet?: unknown;
      squareUrl?: unknown;
      campaignId?: unknown;
      proofToken?: unknown;
    };
    const wallet =
      typeof body.wallet === "string" ? body.wallet.trim() : "";
    const squareUrl =
      typeof body.squareUrl === "string" ? body.squareUrl.trim() : "";
    const campaignId =
      typeof body.campaignId === "string" && body.campaignId.trim()
        ? body.campaignId.trim()
        : "001";
    const proofToken =
      typeof body.proofToken === "string" ? body.proofToken : "";

    if (!wallet || !ethers.isAddress(wallet)) {
      return reply
        .status(400)
        .send({ error: "wallet must be a valid EVM address" });
    }
    if (!squareUrl || !SQUARE_URL_RE.test(squareUrl)) {
      return reply.status(400).send({
        error:
          "squareUrl must be a Binance Square post URL: https://www.binance.com/square/post/<id>",
      });
    }

    // Rate limits: 5/hour per wallet, 20/hour per IP.
    const walletLimit = checkRateLimit(
      {
        capacity: config.rateLimits.submissionsPerWalletPerHour,
        identity: () => wallet.toLowerCase(),
        key: "submissions:wallet",
        windowMs: 60 * 60_000,
      },
      req,
    );
    if (!walletLimit.allowed) {
      reply.header("Retry-After", String(walletLimit.retryAfterSeconds));
      return reply.status(429).send({
        error: `rate limit exceeded: max ${config.rateLimits.submissionsPerWalletPerHour} submissions per wallet per hour`,
        retryAfterSeconds: walletLimit.retryAfterSeconds,
      });
    }
    const ipLimit = checkRateLimit(
      {
        capacity: config.rateLimits.submissionsPerIpPerHour,
        identity: clientIp,
        key: "submissions:ip",
        windowMs: 60 * 60_000,
      },
      req,
    );
    if (!ipLimit.allowed) {
      reply.header("Retry-After", String(ipLimit.retryAfterSeconds));
      return reply.status(429).send({
        error: `rate limit exceeded: max ${config.rateLimits.submissionsPerIpPerHour} submissions per hour from this IP`,
        retryAfterSeconds: ipLimit.retryAfterSeconds,
      });
    }

    // Wallet-ownership proof (Phase 4, backlog item 1): the submitter
    // must prove they control the wallet by signing a challenge
    // (GET /api/auth/challenge → POST /api/auth/verify). Without a
    // valid proof token bound to this wallet, the submission is refused.
    if (!proofToken || !verifyProofToken(proofToken, wallet)) {
      return reply.status(401).send({
        error:
          "prove wallet ownership first: GET /api/auth/challenge, sign the message, POST /api/auth/verify, then submit with the returned proofToken",
      });
    }

    // Agent ID gate (Phase 3): the submitting wallet must hold an Agent
    // ID on the configured registry. Fail closed — an unconfigured
    // registry or an RPC failure is a 503, never a skipped check.
    // (Backlog item 1 — a signature challenge proving wallet ownership
    // at submission time — is Phase 4 scope; this gate proves the
    // wallet holds an Agent ID, which is what the contract enforces.)
    if (!config.agentIdRegistryAddress) {
      return reply.status(503).send({
        error:
          "Agent ID verification not configured: AGENT_ID_REGISTRY_ADDRESS is not set",
      });
    }
    let agentBalance: bigint;
    try {
      agentBalance = await getAgentIdBalance(wallet);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RPC error";
      return reply.status(503).send({
        error: `Agent ID check unavailable, try again later: ${msg}`,
      });
    }
    if (agentBalance === 0n) {
      return reply.status(403).send({
        error:
          "wallet holds no Agent ID on the configured registry — only Agent ID holders can join Campaign 001",
      });
    }

    // One active submission per wallet per campaign.
    const existing = await db.get<SubmissionRow>(
      "SELECT * FROM submissions WHERE wallet = ? AND campaign_id = ? AND status IN ('pending', 'approved') LIMIT 1",
      [wallet.toLowerCase(), campaignId],
    );
    if (existing) {
      return reply.status(409).send({
        error:
          "wallet already has an active submission for this campaign",
        submissionId: existing.id,
      });
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.run(
      "INSERT INTO submissions (id, wallet, square_url, campaign_id, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
      [id, wallet.toLowerCase(), squareUrl, campaignId, createdAt],
    );
    await appendAuditLog(db, {
      action: "submission_created",
      actor: "system",
      detail: squareUrl,
      submissionId: id,
    });
    const row = await db.get<SubmissionRow>(
      "SELECT * FROM submissions WHERE id = ?",
      [id],
    );
    return reply.status(201).send(row);
  });

  app.get("/api/submissions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db.get<SubmissionRow>(
      "SELECT * FROM submissions WHERE id = ?",
      [id],
    );
    if (!row) {
      return reply.status(404).send({ error: "submission not found" });
    }
    // When approved, the response carries the claim voucher the user's
    // agent needs to mint (campaignId, recipient, deadline, nonce,
    // signature). Pending/rejected submissions carry no voucher.
    if (row.status === "approved") {
      const voucher = await db.get<VoucherRow>(
        "SELECT recipient, deadline, nonce, signature FROM vouchers WHERE submission_id = ?",
        [id],
      );
      if (voucher) {
        return {
          ...row,
          voucher: {
            campaignId: Number(row.campaign_id),
            deadline: voucher.deadline,
            nonce: voucher.nonce,
            recipient: voucher.recipient,
            signature: voucher.signature,
          },
        };
      }
    }
    return row;
  });
}
