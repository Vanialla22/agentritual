import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import type { Db } from "../db";
import { getAgentIdBalance } from "../agentId";
import { hasMinted } from "../nft";
import { consumeProofToken, isProofTokenUsed, verifyProofToken } from "../auth";
import { appendAuditLog } from "../auditLog";
import { checkRateLimit, clientIp } from "../rateLimit";
import { config, isAuthorizedCampaign } from "../config";
import { buildVoucher, type BuiltVoucher } from "../voucher";

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

const SQUARE_HOSTS = new Set([
  "binance.com",
  "www.binance.com",
  "app.binance.com",
]);
// Square post IDs observed in the wild are numeric snowflakes of 13–15
// digits (e.g. 380847377801319). Cap at 19: the longest possible signed
// 64-bit snowflake (9,223,372,036,854,775,807), so future growth still
// passes while absurd lengths fail closed.
const SQUARE_ID_RE = /^[A-Za-z0-9_-]{1,19}$/;
const CPOS_ID_RE = /^[0-9]{1,19}$/;
// Only the locales verified live: en and id (both fetched 19 Nov 2026
// and serving the same post). Other real prefixes (sv, sk, en-AE) exist
// but are NOT allowlisted — they fail closed until verified.
const SQUARE_LOCALES = new Set(["en", "id"]);

/**
 * Normalize a user-supplied Binance Square link to the canonical form
 * `https://www.binance.com/square/post/<id>`, or null when the input is
 * not a recognized Square post link.
 *
 * Accepts the three shapes users actually copy:
 * - web:        https://www.binance.com/square/post/<id>
 * - web+locale: https://www.binance.com/en/square/post/<id> (en, id only)
 * - app share:  https://app.binance.com/uni-qr/cpos/<id>?... (query ignored)
 *
 * Post IDs are capped at 19 characters: observed IDs are numeric
 * snowflakes of 13–15 digits, and 19 is the longest possible signed
 * 64-bit snowflake. The URL is never fetched — this is purely
 * syntactic. Query parameters and fragments are dropped entirely
 * (referral codes, tracking tokens). The rebuilt URL is checked
 * against SQUARE_URL_RE before it is returned, so the old regex
 * stays the final gate.
 */
export function normalizeSquareUrl(raw: string): string | null {
  const input = raw.trim();
  if (input === "") return null;
  // WHATWG URL parsing is lenient in ways that hide structure: it
  // treats "\" as "/" for https: URLs, strips tabs/newlines, and
  // resolves "." / ".." segments. Reject those inputs outright.
  if (/[\u0000-\u001f\u007f\\]/.test(input)) return null;
  if (
    input.includes("/./") ||
    input.includes("/../") ||
    input.endsWith("/.") ||
    input.endsWith("/..")
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.port !== "") return null;
  if (!SQUARE_HOSTS.has(url.hostname)) return null;
  // Any percent-encoding in the path could hide structure (%2F -> "/"),
  // and post IDs never contain "%", so reject it outright.
  if (url.pathname.includes("%")) return null;
  // Split the path without collapsing empty segments, so "//" or a
  // double trailing slash is rejected instead of silently normalized.
  const path = url.pathname.endsWith("/")
    ? url.pathname.slice(0, -1)
    : url.pathname;
  const parts = path.split("/");
  let id: string | null = null;
  if (url.hostname === "app.binance.com") {
    // App share link only: /uni-qr/cpos/<numeric id>
    if (
      parts.length === 4 &&
      parts[0] === "" &&
      parts[1] === "uni-qr" &&
      parts[2] === "cpos" &&
      CPOS_ID_RE.test(parts[3])
    ) {
      id = parts[3];
    }
  } else if (
    parts.length === 4 &&
    parts[0] === "" &&
    parts[1] === "square" &&
    parts[2] === "post" &&
    SQUARE_ID_RE.test(parts[3])
  ) {
    id = parts[3];
  } else if (
    parts.length === 5 &&
    parts[0] === "" &&
    SQUARE_LOCALES.has(parts[1]) &&
    parts[2] === "square" &&
    parts[3] === "post" &&
    SQUARE_ID_RE.test(parts[4])
  ) {
    id = parts[4];
  }
  if (id === null) return null;
  const canonical = `https://www.binance.com/square/post/${id}`;
  // Final gate: the pre-existing regex must accept the rebuilt URL.
  return SQUARE_URL_RE.test(canonical) ? canonical : null;
}

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
    const rawSquareUrl =
      typeof body.squareUrl === "string" ? body.squareUrl.trim() : "";
    // App share links (app.binance.com/uni-qr/cpos/...) and locale web
    // links (/en/square/post/...) are normalized to the canonical form
    // before validation. The stored URL is always canonical, and the
    // old regex still runs as the final gate inside normalizeSquareUrl.
    const squareUrl = normalizeSquareUrl(rawSquareUrl);
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
    if (!squareUrl) {
      return reply.status(400).send({
        error:
          "squareUrl must be a Binance Square post URL: https://www.binance.com/square/post/<id> (app share links are accepted and normalized)",
      });
    }

    // Campaign allowlist (hardening review H-6): only authorized
    // campaigns accept submissions. Checked before any rate-limit or
    // proof work, so an unauthorized campaign can never reach review.
    if (!isAuthorizedCampaign(campaignId)) {
      return reply.status(400).send({
        error: `campaign ${campaignId} is not authorized`,
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
    // Proof tokens are single-use (hardening review H-1): a token that
    // already backed a submission is refused here.
    if (!proofToken || !verifyProofToken(proofToken, wallet)) {
      return reply.status(401).send({
        error:
          "prove wallet ownership first: GET /api/auth/challenge, sign the message, POST /api/auth/verify, then submit with the returned proofToken",
      });
    }
    if (await isProofTokenUsed(db, proofToken)) {
      return reply.status(401).send({
        error:
          "proof token already used — request a new challenge and verify again",
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

    // One active submission per wallet per campaign — with one
    // exception (21 Nov 2026, resubmit fix): an APPROVED submission
    // whose voucher has already expired no longer blocks a new
    // submission. The user just submits again for a fresh voucher;
    // the old row stays as history. Pending submissions still block
    // (they await an admin decision — the admin can reject one to
    // free the wallet), and an approved submission with a live
    // voucher still blocks (use the voucher you have).
    // One mint per wallet per campaign is enforced on-chain
    // (hasMinted) and can never be bypassed by resubmitting — this
    // handler also refuses an already-minted wallet early (409) so
    // nobody wastes gas on a mint that must revert.
    let minted: boolean;
    try {
      minted = await hasMinted(Number(campaignId), wallet.toLowerCase());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RPC error";
      return reply.status(503).send({
        error: `mint check unavailable, try again later: ${msg}`,
      });
    }
    if (minted) {
      return reply.status(409).send({
        error: "wallet already minted for this campaign",
      });
    }
    const existing = await db.get<SubmissionRow>(
      "SELECT * FROM submissions WHERE wallet = ? AND campaign_id = ? AND status IN ('pending', 'approved') LIMIT 1",
      [wallet.toLowerCase(), campaignId],
    );
    if (existing) {
      let blocks = true;
      if (existing.status === "approved") {
        const voucherRow = await db.get<{ deadline: number }>(
          "SELECT deadline FROM vouchers WHERE submission_id = ?",
          [existing.id],
        );
        // No voucher row = inconsistent state; fail closed (block).
        // Expired voucher = the old submission no longer blocks.
        if (
          voucherRow &&
          voucherRow.deadline <= Math.floor(Date.now() / 1000)
        ) {
          blocks = false;
        }
      }
      if (blocks) {
        return reply.status(409).send({
          error:
            "wallet already has an active submission for this campaign",
          submissionId: existing.id,
        });
      }
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    // Auto-approve (21 Nov 2026, both chains): when enabled (default
    // on), a submission that passes every automated check is approved
    // immediately with a signed voucher — no admin review. The voucher
    // is signed BEFORE the proof token is consumed, so a signing
    // failure leaves no state behind and the user can retry with a
    // fresh challenge. When signing is unavailable, fail closed with
    // 503 (never silently create a pending submission the user cannot
    // see a reason for). When auto-approve is off (AUTO_APPROVE=false),
    // the submission is created pending for manual admin review.
    let voucher: BuiltVoucher | null = null;
    if (config.autoApprove) {
      try {
        voucher = await buildVoucher(wallet.toLowerCase(), Number(campaignId));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "signing failed";
        return reply.status(503).send({
          error: `voucher signing failed: ${msg}`,
        });
      }
    }
    // Consume the proof token only now that every other check has
    // passed, so a failed submission (409/503) does not burn it. The
    // UNIQUE constraint on used_proof_tokens is the atomic guard
    // against two concurrent submissions racing on the same token.
    const consumed = await consumeProofToken(db, proofToken, wallet);
    if (!consumed) {
      return reply.status(401).send({
        error:
          "proof token already used — request a new challenge and verify again",
      });
    }
    const status = voucher ? "approved" : "pending";
    await db.run(
      "INSERT INTO submissions (id, wallet, square_url, campaign_id, status, created_at, review_note, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        wallet.toLowerCase(),
        squareUrl,
        campaignId,
        status,
        createdAt,
        voucher ? "auto-approved" : null,
        voucher ? createdAt : null,
      ],
    );
    await appendAuditLog(db, {
      action: "submission_created",
      actor: "system",
      detail: squareUrl,
      submissionId: id,
    });
    if (voucher) {
      await db.run(
        "INSERT INTO vouchers (submission_id, recipient, deadline, nonce, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          id,
          wallet.toLowerCase(),
          voucher.deadline,
          voucher.nonce,
          voucher.signature,
          createdAt,
        ],
      );
      // Audit detail carries the voucher DIGEST, never the signature.
      await appendAuditLog(db, {
        action: "submission_auto_approved",
        actor: "system",
        detail: `${id} voucher ${voucher.digest}`,
        submissionId: id,
      });
    }
    const row = await db.get<SubmissionRow>(
      "SELECT * FROM submissions WHERE id = ?",
      [id],
    );
    // When auto-approved, the response carries the claim voucher the
    // user's agent needs to mint — same shape as GET /api/submissions/:id
    // for approved submissions, so the web shows it without a refetch.
    return reply.status(201).send(
      voucher
        ? {
            ...row,
            voucher: {
              campaignId: voucher.campaignId,
              deadline: voucher.deadline,
              nonce: voucher.nonce,
              recipient: voucher.recipient,
              signature: voucher.signature,
            },
          }
        : row,
    );
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
