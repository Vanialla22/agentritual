import type { FastifyInstance, FastifyRequest } from "fastify";
import { ethers, type EventLog } from "ethers";
import type { Db } from "../db";
import { config, isAuthorizedCampaign } from "../config";
import {
  createAdminSession,
  isAdminSessionRevoked,
  revokeAdminSession,
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
 * Admin endpoints (Phase 4, hardened in the Phase 4 review).
 *
 * - POST /api/admin/login {password} → {token} (2 h HMAC session).
 * - POST /api/admin/logout → revokes the current session token.
 * - All other /api/admin/* routes require `Authorization: Bearer <token>`
 *   and reject revoked tokens.
 * - POST /api/admin/review {submissionId, decision, note?} — approve
 *   signs a voucher (deadline ≤ 1 h) and stores it; reject stores the
 *   note. Self-APPROVAL is blocked server-side when ADMIN_WALLET is set
 *   (rejecting your own submission is allowed). Unauthorized campaigns
 *   are refused (400).
 * - GET  /api/admin/submissions?status=pending — review queue.
 * - GET  /api/admin/audit-log (+ ?limit=&offset=) — hash-chained log.
 * - GET  /api/admin/audit-log/verify (+ ?expectedLatest=&expectedCount=)
 *   — recompute the chain, optionally against an external checkpoint.
 * - GET  /api/admin/audit-log/checkpoint — latest hash/seq/count, for
 *   recording outside this database.
 * - GET  /api/admin/mint-audit — Mint events matched to vouchers, with
 *   known-test mints separated from anomalies.
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

/**
 * Admin session check: valid HMAC token (signature + expiry) AND not
 * revoked via logout. Revocation is a DB lookup (hardening review H-2);
 * without it, a stolen or logged-out token would stay valid until expiry.
 */
async function requireAdmin(req: FastifyRequest, db: Db): Promise<boolean> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token === "") return false;
  if (verifyAdminSession(token) === null) return false;
  if (await isAdminSessionRevoked(db, token)) return false;
  return true;
}

function bearerToken(req: FastifyRequest): string {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
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
    if (!(await requireAdmin(req, db))) {
      return reply.status(401).send({
        error: "admin authentication required",
      });
    }
  });

  // Logout (hardening review H-2): revokes the current session token
  // server-side, so it stops working immediately — before its 2 h
  // expiry. The token hash (never the token) is stored in
  // revoked_sessions; rotation of ADMIN_SESSION_SECRET also kills all
  // sessions (see docs/admin-rights.md).
  app.post("/api/admin/logout", async (req, reply) => {
    const token = bearerToken(req);
    const payload = verifyAdminSession(token);
    if (!payload) {
      return reply.status(401).send({
        error: "admin authentication required",
      });
    }
    await revokeAdminSession(db, token, payload.exp);
    return { revoked: true };
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
    // Campaign allowlist (hardening review H-6, defense in depth):
    // a submission for an unauthorized campaign can never be decided,
    // even if it was inserted before the allowlist existed.
    if (!isAuthorizedCampaign(sub.campaign_id)) {
      return reply.status(400).send({
        error: `campaign ${sub.campaign_id} is not authorized`,
      });
    }
    // Self-approval block (Phase 0 prototype flaw, enforced server-side):
    // the admin cannot APPROVE a submission from their own wallet —
    // approval issues a voucher to themselves. REJECT is allowed: it
    // denies value rather than granting it, and blocking it would leave
    // the admin's own submissions undecidable forever (hardening review
    // H-2: the Phase 4 block covered both decisions).
    if (
      decision === "approve" &&
      config.adminWallet &&
      sub.wallet.toLowerCase() === config.adminWallet
    ) {
      return reply.status(403).send({
        error: "admin cannot approve their own submission",
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

  app.get("/api/admin/audit-log/verify", async (req) => {
    const result = await verifyAuditLogChain(db);
    // External checkpoint comparison (hardening review H-3): pass the
    // latest entry hash + count recorded OUTSIDE this database (see
    // docs/admin-rights.md). A full-chain rewrite recomputes every
    // hash, so verify() alone reports valid=true — only the checkpoint
    // comparison catches it. checkpointMatch is null when no expected
    // values were supplied.
    const { expectedLatest, expectedCount } = (req.query ?? {}) as {
      expectedLatest?: unknown;
      expectedCount?: unknown;
    };
    let checkpointMatch: boolean | null = null;
    if (typeof expectedLatest === "string" && expectedLatest) {
      checkpointMatch =
        result.latestEntryHash === expectedLatest.toLowerCase();
    }
    if (typeof expectedCount === "string" && expectedCount !== "") {
      const n = Number(expectedCount);
      if (Number.isSafeInteger(n)) {
        checkpointMatch = (checkpointMatch ?? true) && result.checked === n;
      }
    }
    return { ...result, checkpointMatch };
  });

  // Latest checkpoint values, for recording OUTSIDE this database.
  // An admin records {latestEntryHash, latestSeq, count} after each
  // review session (a note, a second server, a public post, or an
  // on-chain anchor) and later verifies against them.
  app.get("/api/admin/audit-log/checkpoint", async () => {
    const result = await verifyAuditLogChain(db);
    return {
      checked: result.checked,
      computedAt: new Date().toISOString(),
      latestEntryHash: result.latestEntryHash,
      latestSeq: result.latestSeq,
      valid: result.valid,
    };
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
      // Match each mint against its voucher AND the approval record.
      // A voucher is identified by (recipient, campaign); the digest is
      // recomputed from the stored voucher fields so the response shows
      // exactly which signed voucher the mint corresponds to.
      const vouchers = await db.all<
        VoucherRow & { campaign_id: string; submission_id: string }
      >(
        `SELECT v.*, s.campaign_id FROM vouchers v
         JOIN submissions s ON s.id = v.submission_id`,
      );
      const domain = getVoucherDomain();
      const voucherByKey = new Map(
        vouchers.map((v) => {
          const digest = ethers.TypedDataEncoder.hash(
            domain,
            VOUCHER_TYPES,
            {
              campaignId: Number(v.campaign_id),
              deadline: v.deadline,
              nonce: v.nonce,
              recipient: v.recipient,
            },
          );
          return [
            `${v.recipient.toLowerCase()}|${Number(v.campaign_id)}`,
            {
              approvedAt: null as string | null,
              digest,
              submissionId: v.submission_id,
            },
          ];
        }),
      );
      const approvals = await db.all<{
        submission_id: string;
        created_at: string;
      }>(
        "SELECT submission_id, created_at FROM audit_log WHERE action = 'submission_approved'",
      );
      for (const a of approvals) {
        for (const v of voucherByKey.values()) {
          if (v.submissionId === a.submission_id) v.approvedAt = a.created_at;
        }
      }
      const knownTest = new Set(config.knownTestMintTxHashes);
      const matched: unknown[] = [];
      const unmatched: unknown[] = [];
      const knownTestMints: unknown[] = [];
      const anomalies: unknown[] = [];
      for (const ev of events) {
        const campaignId = Number(ev.args?.[0] as bigint);
        const tokenId = Number(ev.args?.[1] as bigint);
        const recipient = ((ev.args?.[2] as string) ?? "").toLowerCase();
        const txHash = ev.transactionHash;
        const match =
          voucherByKey.get(`${recipient}|${campaignId}`) ?? null;
        // Classification (hardening review H-5): a mint with a voucher
        // is "matched"; a mint whose tx hash is in the documented
        // historical test-mint list is "known-test"; anything else is
        // an "anomaly" — a mint with no voucher record, which must be
        // investigated (signer compromise, contract misuse, or a
        // voucher issued outside this API).
        const classification = match
          ? "matched"
          : knownTest.has(txHash.toLowerCase())
            ? "known-test"
            : "anomaly";
        const entry = {
          blockNumber: ev.blockNumber,
          campaignId,
          classification,
          match,
          recipient,
          tokenId,
          txHash,
        };
        if (match) {
          matched.push(entry);
        } else {
          unmatched.push(entry);
          if (classification === "known-test") knownTestMints.push(entry);
          else anomalies.push(entry);
        }
      }
      return {
        anomalies,
        chainId: config.chainId,
        checked: events.length,
        contractAddress: config.nftContractAddress,
        fromBlock,
        knownTest: knownTestMints,
        latestBlock,
        matched,
        unmatched,
        // M-1 fix: when NFT_DEPLOY_BLOCK is unset (0), the scan covered
        // only the trailing 5,000 blocks. windowTruncated flags that so
        // a "0 anomalies" answer can never be read as a clean bill
        // without seeing the window.
        windowTruncated: config.nftDeployBlock <= 0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RPC error";
      return reply.status(503).send({
        error: `mint audit unavailable: ${msg}`,
      });
    }
  });
}
