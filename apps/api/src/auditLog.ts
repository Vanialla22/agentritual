import { createHash } from "node:crypto";
import type { Db } from "./db";

/**
 * Hash-chained append-only audit log (Phase 4, backlog item 2).
 *
 * Every row carries prev_hash (the previous row's entry_hash) and
 * entry_hash = SHA-256(prev_hash || submission_id || actor || action ||
 * detail || created_at). The first row uses 64 zeros as prev_hash.
 * There is NO update/delete path for audit_log anywhere in the API.
 *
 * Writes are serialized through a tiny in-process mutex so two
 * concurrent appends cannot read the same previous hash.
 */

const GENESIS_PREV_HASH = "0".repeat(64);

export function computeEntryHash(input: {
  prevHash: string;
  submissionId: string | null;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.prevHash,
        input.submissionId ?? "",
        input.actor,
        input.action,
        input.detail,
        input.createdAt,
      ].join("|"),
    )
    .digest("hex");
}

interface AuditRow {
  id: number;
  submission_id: string | null;
  actor: string;
  action: string;
  detail: string | null;
  created_at: string;
  prev_hash: string | null;
  entry_hash: string | null;
  seq: number | null;
}

let appendQueue: Promise<void> = Promise.resolve();

/** Append one chained row. Returns the new row id. */
export function appendAuditLog(
  db: Db,
  entry: {
    submissionId?: string | null;
    actor: string;
    action: string;
    detail?: string;
  },
): Promise<number> {
  const task = appendQueue.then(async () => {
    const createdAt = new Date().toISOString();
    const last = await db.get<{ entry_hash: string | null; seq: number | null }>(
      "SELECT entry_hash, seq FROM audit_log ORDER BY id DESC LIMIT 1",
    );
    const prevHash = last?.entry_hash ?? GENESIS_PREV_HASH;
    // App-assigned sequence (hardening review): strictly +1 per row,
    // assigned inside the same serialized queue as the hash chain, so
    // seq and prev_hash always agree about the order.
    const seq = (last?.seq ?? 0) + 1;
    const detail = entry.detail ?? "";
    const entryHash = computeEntryHash({
      action: entry.action,
      actor: entry.actor,
      createdAt,
      detail,
      prevHash,
      submissionId: entry.submissionId ?? null,
    });
    await db.run(
      "INSERT INTO audit_log (submission_id, actor, action, detail, created_at, prev_hash, entry_hash, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        entry.submissionId ?? null,
        entry.actor,
        entry.action,
        detail,
        createdAt,
        prevHash,
        entryHash,
        seq,
      ],
    );
    const row = await db.get<{ id: number }>(
      "SELECT id FROM audit_log ORDER BY id DESC LIMIT 1",
    );
    return row?.id ?? -1;
  });
  // Keep the queue alive even if one append fails.
  appendQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

/**
 * Backfill the hash chain for rows written before Phase 4 (entry_hash
 * NULL). Safe: the production DB does not exist yet, so only test DBs
 * carry legacy rows. Rows are chained in id order.
 */
export async function backfillAuditLogChain(db: Db): Promise<number> {
  const rows = await db.all<AuditRow>(
    "SELECT * FROM audit_log WHERE entry_hash IS NULL ORDER BY id ASC",
  );
  if (rows.length === 0) return 0;
  const lastChained = await db.get<{ entry_hash: string }>(
    "SELECT entry_hash FROM audit_log WHERE entry_hash IS NOT NULL ORDER BY id DESC LIMIT 1",
  );
  let prevHash = lastChained?.entry_hash ?? GENESIS_PREV_HASH;
  for (const row of rows) {
    const entryHash = computeEntryHash({
      action: row.action,
      actor: row.actor,
      createdAt: row.created_at,
      detail: row.detail ?? "",
      prevHash,
      submissionId: row.submission_id,
    });
    await db.run(
      "UPDATE audit_log SET prev_hash = ?, entry_hash = ? WHERE id = ?",
      [prevHash, entryHash, row.id],
    );
    prevHash = entryHash;
  }
  return rows.length;
}

/** Recompute the full chain. Returns validity + where it first breaks. */
export async function verifyAuditLogChain(db: Db): Promise<{
  valid: boolean;
  checked: number;
  firstBadIndex?: number;
  latestEntryHash: string | null;
  latestSeq: number | null;
}> {
  const rows = await db.all<AuditRow>(
    "SELECT * FROM audit_log ORDER BY id ASC",
  );
  let prevHash = GENESIS_PREV_HASH;
  let prevSeq = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const bad = (index: number) => ({
      checked: rows.length,
      firstBadIndex: index,
      latestEntryHash: rows.length > 0 ? rows[rows.length - 1].entry_hash : null,
      latestSeq: rows.length > 0 ? rows[rows.length - 1].seq : null,
      valid: false,
    });
    // Sequence check (hardening review): seq must be a number and
    // strictly +1 per row. A deletion or reorder that only fixes the
    // hashes still breaks the sequence.
    if (typeof row.seq !== "number" || row.seq !== prevSeq + 1) {
      return bad(i);
    }
    if (row.prev_hash !== prevHash || !row.entry_hash) {
      return bad(i);
    }
    const expected = computeEntryHash({
      action: row.action,
      actor: row.actor,
      createdAt: row.created_at,
      detail: row.detail ?? "",
      prevHash,
      submissionId: row.submission_id,
    });
    if (expected !== row.entry_hash) {
      return bad(i);
    }
    prevHash = row.entry_hash;
    prevSeq = row.seq;
  }
  return {
    checked: rows.length,
    latestEntryHash: rows.length > 0 ? rows[rows.length - 1].entry_hash : null,
    latestSeq: rows.length > 0 ? rows[rows.length - 1].seq : null,
    valid: true,
  };
}

/**
 * Assign seq numbers to rows written before migration 005 (seq NULL),
 * in id order, continuing after the highest existing seq. Safe: the
 * production DB does not exist yet; only test DBs carry legacy rows.
 */
export async function backfillAuditLogSeq(db: Db): Promise<number> {
  const rows = await db.all<{ id: number }>(
    "SELECT id FROM audit_log WHERE seq IS NULL ORDER BY id ASC",
  );
  if (rows.length === 0) return 0;
  const max = await db.get<{ m: number | null }>(
    "SELECT MAX(seq) AS m FROM audit_log WHERE seq IS NOT NULL",
  );
  let seq = (max?.m ?? 0) + 1;
  for (const row of rows) {
    await db.run("UPDATE audit_log SET seq = ? WHERE id = ?", [seq, row.id]);
    seq += 1;
  }
  return rows.length;
}
