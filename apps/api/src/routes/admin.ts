import type { FastifyInstance, FastifyRequest } from "fastify";
import { ethers, type EventLog } from "ethers";
import type { Db } from "../db";
import { config } from "../config";
import {
  createAdminSession,
  verifyAdminPassword,
  verifyAdminSession,
} from "../auth";
import { appendAuditLog, verifyAuditLogChain } from "../auditLog";
import { checkRateLimit, clientIp } from "../rateLimit";
import {
  getVoucherDomain,
  MAX_VOUCHER_TTL_SECONDS,
  newVoucherNonce,
  signVoucher,
  VOUCHER_TYPES,
} from "../voucher";

/**
 * Admin endpoints (Phase 4).
 *
 * - POST /api/admin/login {password} → {token} (2 h HMAC session).
 * - All other /api/admin/* routes require `Authorization: Bearer <token>`.
 * - POST /api/admin/review {submissionId, decision, note?} — approve
 *   signs a voucher (deadline ≤ 1 h) and stores it; reject stores the
 *   note. Self-approval is blocked server-side when ADMIN_WALLET is set.
 * - GET  /api/admin/submissions?status=pending — review queue.
 * - GET  /api/admin/audit-log (+ ?limit=&offset=) — hash-chained log.
 * - GET  /api/admin/audit-log/verify — recompute the chain.
 * - GET  /api/admin/mint-audit — Mint events without a matching voucher.
 *
 * The audit log is append-only: no UPDATE/DELETE endpoint exists, ever.
 */

interface SubmissionRow {
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
  submission_id: string;
  recipient: string;
  deadline: number;
  nonce: string;
  signature: string;
  created_at: string;
}

function requireAdmin(req: FastifyRequest): boolean {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token !== "" && verifyAdminSession(token) !== null;
}

export function registerAdminRoutes(app: FastifyInstance, db: Db) {
  // Login is rate-limited: 5 attempts / 15 min per IP (brute-force guard).
  app.post("/api/admin/login", async (req, reply) => {
    const limit = checkRateLimit(
      {
        capacity: config.rateLimits.loginPerIpPer15Min,
        identity: clientIp,
        key: "login:ip",
        windowMs: 15 * 60_000,
      },
      req,
    );
    if (!limit.allowed) {
      reply.header("Retry-After", String(limit.retryAfterSeconds));
      return reply.status(429).send({
        error: `too many login attempts — try again in ${limit.retryAfterSeconds}s`,
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }
    const body = (req.body ?? {}) as { password?: unknown };
    const password =
      typeof body.password === "string" ? body.password : "";
    if (!config.adminPasswordHash) {
      return reply.status(503).send({
        error:
          "admin login not configured: ADMIN_PASSWORD_HASH is not set",
      });
    }
    // Generic message on purpose: do not reveal whether the hash is
    // misconfigured or the password is wrong.
    if (!password || !verifyAdminPassword(password, config.adminPasswordHash)) {
      return reply.status(401).send({ error: "invalid credentials" });
    }
    const token = createAdminSession();
    if (!token) {
      return reply.status(503).send({
        error: "admin login not configured: ADMIN_SESSION_SECRET is not set",
      });
    }
    return { expiresInSeconds: 2 * 60 * 60, token };
  });

  // All routes below require a valid admin session.
  app.addHook("preHandler", async (req, reply) => {
    const url = req.url.split("?")[0];
    if (!url.startsWith("/api/admin/") || url === "/api/admin/login") {
      return;
    }
    if (!requireAdmin(req)) {
      return reply.status(401).send({
        error: "admin authentication required",
      });
    }
  });

  app.get("/api/admin/submissions", async (req, reply) => {
    const { status, limit, offset } = (req.query ?? {}) as {
      status?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
    const lim = Math.min(Math.max(Number(limit ?? 50) || 50, 1), 200);
    const off = Math.max(Number(offset ?? 0) || 0, 0);
    const where =
      typeof status === "string" && status
        ? "WHERE status = ?"
        : "";
    const params: unknown[] = typeof status === "string" && status ? [status] : [];
    const rows = await db.all<SubmissionRow>(
      `SELECT * FROM submissions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, lim, off],
    );
    return { items: rows, limit: lim, offset: off };
  });

  app.post("/api/admin/review", async (req, reply) => {
    const body = (req.body ?? {}) as {
      submissionId?: unknown;
      decision?: unknown;
      note?: unknown;
    };
    const submissionId =
      typeof body.submissionId === "string" ? body.submissionId : "";
    const decision =
      typeof body.decision === "string" ? body.decision : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!submissionId || (decision !== "approve" && decision !== "reject")) {
      return reply.status(400).send({
        error:
          'submissionId and decision ("approve" | "reject") are required',
      });
    }
    const sub = await db.get<SubmissionRow>(
      "SELECT * FROM submissions WHERE id = ?",
      [submissionId],
    );
    if (!sub) {
      return reply.status(404).send({ error: "submission not found" });
    }
    if (sub.status !== "pending") {
      return reply.status(409).send({
        error: `submission is already ${sub.status} — only pending submissions can be decided`,
      });
    }
    // Self-approval block (Phase 0 prototype flaw, enforced server-side):
    // the admin cannot decide a submission from their own wallet.
    if (config.adminWallet && sub.wallet.toLowerCase() === config.adminWallet) {
      return reply.status(403).send({
        error: "admin cannot review their own submission",
      });
    }
    const reviewedAt = new Date().toISOString();

    if (decision === "reject") {
      await db.run(
        "UPDATE submissions SET status = 'rejected', review_note = ?, reviewed_at = ? WHERE id = ?",
        [note || null, reviewedAt, submissionId],
      );
      await appendAuditLog(db, {
        action: "submission_rejected",
        actor: "admin",
        detail: note ? `${submissionId}: ${note}` : submissionId,
        submissionId,
      });
      return { id: submissionId, note: note || null, status: "rejected" };
    }

    // Approve: sign a voucher (deadline capped at 1 h by signVoucher).
    if (!config.adminSignerKey || !config.nftContractAddress) {
      return reply.status(503).send({
        error: "voucher signing not configured",
      });
    }
    const campaignId = Number(sub.campaign_id);
    if (!Number.isSafeInteger(campaignId)) {
      return reply.status(400).send({
        error: "submission campaign_id is not a valid number",
      });
    }
    const deadline =
      Math.floor(Date.now() / 1000) + MAX_VOUCHER_TTL_SECONDS;
    const nonce = newVoucherNonce();
    let signature: string;
    try {
      signature = await signVoucher({
        campaignId,
        deadline,
        nonce,
        recipient: sub.wallet,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "signing failed";
      return reply.status(503).send({ error: `voucher signing failed: ${msg}` });
    }
    const domain = getVoucherDomain();
    const digest = ethers.TypedDataEncoder.hash(
      domain,
      VOUCHER_TYPES,
      { campaignId, deadline, nonce, recipient: sub.wallet },
    );
    await db.run(
      "INSERT INTO vouchers (submission_id, recipient, deadline, nonce, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [submissionId, sub.wallet.toLowerCase(), deadline, nonce, signature, reviewedAt],
    );
    await db.run(
      "UPDATE submissions SET status = 'approved', review_note = ?, reviewed_at = ? WHERE id = ?",
      [note || null, reviewedAt, submissionId],
    );
    // Audit detail carries the voucher DIGEST, never the signature.
    await appendAuditLog(db, {
      action: "submission_approved",
      actor: "admin",
      detail: `${submissionId} voucher ${digest}`,
      submissionId,
    });
    return {
      id: submissionId,
      status: "approved",
      voucher: {
        campaignId,
        deadline,
        digest,
        nonce,
        recipient: sub.wallet,
        signature,
      },
    };
  });

  app.get("/api/admin/audit-log", async (req) => {
    const { limit, offset } = (req.query ?? {}) as {
      limit?: unknown;
      offset?: unknown;
    };
    const lim = Math.min(Math.max(Number(limit ?? 50) || 50, 1), 200);
    const off = Math.max(Number(offset ?? 0) || 0, 0);
    const rows = await db.all(
      "SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?",
      [lim, off],
    );
    return { items: rows, limit: lim, offset: off };
  });

  app.get("/api/admin/audit-log/verify", async () => {
    return verifyAuditLogChain(db);
  });

  app.get("/api/admin/mint-audit", async (_req, reply) => {
    if (!config.nftContractAddress) {
      return reply.status(503).send({
        error: "mint audit not configured: NFT contract not deployed yet",
      });
    }
    try {
      const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
      const nft = new ethers.Contract(
        config.nftContractAddress,
        [
          "event Mint(uint256 indexed campaignId, uint256 indexed tokenId, address indexed recipient)",
        ],
        provider,
      );
      const latestBlock = await provider.getBlockNumber();
      const fromBlock =
        config.nftDeployBlock > 0
          ? config.nftDeployBlock
          : Math.max(0, latestBlock - 5000);
      const events = (await nft.queryFilter(
        nft.filters.Mint,
        fromBlock,
        latestBlock,
      )) as EventLog[];
      const vouchers = await db.all<VoucherRow & { campaign_id: string }>(
        `SELECT v.*, s.campaign_id FROM vouchers v
         JOIN submissions s ON s.id = v.submission_id`,
      );
      const voucherKeys = new Set(
        vouchers.map(
          (v) => `${v.recipient.toLowerCase()}|${Number(v.campaign_id)}`,
        ),
      );
      const matched: unknown[] = [];
      const unmatched: unknown[] = [];
      for (const ev of events) {
        const campaignId = Number(ev.args?.[0] as bigint);
        const tokenId = Number(ev.args?.[1] as bigint);
        const recipient = ((ev.args?.[2] as string) ?? "").toLowerCase();
        const entry = {
          blockNumber: ev.blockNumber,
          campaignId,
          recipient,
          tokenId,
          txHash: ev.transactionHash,
        };
        // A mint matches when a voucher exists for the same recipient
        // and campaign (campaign stored as "001" in submissions, 1
        // on-chain — compare numerically).
        if (voucherKeys.has(`${recipient}|${campaignId}`)) {
          matched.push(entry);
        } else {
          unmatched.push(entry);
        }
      }
      return {
        chainId: config.chainId,
        checked: events.length,
        contractAddress: config.nftContractAddress,
        fromBlock,
        matched,
        unmatched,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RPC error";
      return reply.status(503).send({
        error: `mint audit unavailable: ${msg}`,
      });
    }
  });
}
