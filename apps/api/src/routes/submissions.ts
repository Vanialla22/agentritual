import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import type { Db } from "../db";
import { getAgentIdBalance } from "../agentId";
import { config } from "../config";

export interface SubmissionRow {
  id: string;
  wallet: string;
  square_url: string;
  campaign_id: string;
  status: string;
  created_at: string;
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
    };
    const wallet =
      typeof body.wallet === "string" ? body.wallet.trim() : "";
    const squareUrl =
      typeof body.squareUrl === "string" ? body.squareUrl.trim() : "";
    const campaignId =
      typeof body.campaignId === "string" && body.campaignId.trim()
        ? body.campaignId.trim()
        : "001";

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
    await db.run(
      "INSERT INTO audit_log (submission_id, actor, action, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, "system", "submission_created", squareUrl, createdAt],
    );
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
    return row;
  });
}
