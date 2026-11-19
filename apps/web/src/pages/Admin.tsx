import { useState } from "react";
import { Card, GoldButton, HonestNote, SectionTitle } from "../App";
import {
  adminLogin,
  adminReview,
  fetchAdminSubmissions,
  fetchAuditLog,
  fetchMintAudit,
  verifyAuditLog,
  type AdminSubmission,
  type AuditLogEntry,
  type MintAuditEntry,
  type Voucher,
} from "../lib/api";

export function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [queue, setQueue] = useState<AdminSubmission[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [lastVoucher, setLastVoucher] = useState<Voucher | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditValid, setAuditValid] = useState<string | null>(null);
  const [mintAudit, setMintAudit] = useState<{
    checked: number;
    matched: MintAuditEntry[];
    unmatched: MintAuditEntry[];
    fromBlock: number;
  } | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);

  async function loadQueue(t: string) {
    setQueueBusy(true);
    setQueueError(null);
    try {
      const res = await fetchAdminSubmissions(t, "pending");
      setQueue(res.items);
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Queue failed.");
    } finally {
      setQueueBusy(false);
    }
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    try {
      const t = await adminLogin(password);
      setToken(t);
      setPassword("");
      await loadQueue(t);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function onReview(
    sub: AdminSubmission,
    decision: "approve" | "reject",
  ) {
    if (!token) return;
    setReviewBusy(sub.id + decision);
    setReviewError(null);
    setLastVoucher(null);
    try {
      const res = await adminReview(token, {
        decision,
        note: notes[sub.id] ?? "",
        submissionId: sub.id,
      });
      if (res.voucher) setLastVoucher(res.voucher);
      await loadQueue(token);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setReviewBusy(null);
    }
  }

  async function loadAudit() {
    if (!token) return;
    setAuditError(null);
    try {
      const res = await fetchAuditLog(token);
      setAudit(res.items);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Audit log failed.");
    }
  }

  async function onVerifyAudit() {
    if (!token) return;
    setAuditValid(null);
    try {
      const res = await verifyAuditLog(token);
      setAuditValid(
        res.valid
          ? `✓ Chain valid — ${res.checked} entries verified.`
          : `✗ Chain BROKEN at entry #${res.firstBadIndex} of ${res.checked}.`,
      );
    } catch (err) {
      setAuditValid(err instanceof Error ? err.message : "Verify failed.");
    }
  }

  async function loadMintAudit() {
    if (!token) return;
    setMintError(null);
    try {
      const res = await fetchMintAudit(token);
      setMintAudit(res);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Mint audit failed.");
    }
  }

  return (
    <div className="space-y-10 pt-8">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          Review dashboard
        </h1>
        <p className="mt-3 max-w-3xl text-muted">
          Admins manually review Square proof submissions and approve or
          reject them. Approval issues a signed claim voucher bound to the
          submitter&apos;s wallet.
        </p>
      </section>

      {!token && (
        <Card>
          <SectionTitle>Admin sign-in</SectionTitle>
          <form onSubmit={onLogin} className="space-y-4">
            <div>
              <label
                htmlFor="adminPassword"
                className="mb-1 block text-sm font-semibold text-white"
              >
                Admin password
              </label>
              <input
                id="adminPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted">
                Checked against a scrypt hash in the server env — the password
                is never stored. The session token lives in memory only and
                expires after 2 hours.
              </p>
            </div>
            <GoldButton disabled={loginBusy} type="submit">
              {loginBusy ? "Signing in…" : "Sign in"}
            </GoldButton>
          </form>
          {loginError && (
            <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {loginError}
            </p>
          )}
        </Card>
      )}

      {token && (
        <>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>Pending submissions</SectionTitle>
              <button
                type="button"
                onClick={() => loadQueue(token)}
                disabled={queueBusy}
                className="rounded-md border border-gold/60 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-50"
              >
                {queueBusy ? "Refreshing…" : "Refresh queue"}
              </button>
            </div>
            {queueError && (
              <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {queueError}
              </p>
            )}
            {queue.length === 0 && !queueError && (
              <Card>
                <p className="text-sm text-muted">
                  No pending submissions right now.
                </p>
              </Card>
            )}
            <div className="mt-4 space-y-4">
              {queue.map((sub) => (
                <Card key={sub.id}>
                  <p className="break-all font-mono text-xs text-muted">
                    {sub.id}
                  </p>
                  <p className="mt-1 text-sm text-zinc-200">
                    Wallet:{" "}
                    <span className="break-all font-mono text-xs">
                      {sub.wallet}
                    </span>
                  </p>
                  <a
                    className="mt-1 block break-all text-sm text-gold underline"
                    href={sub.square_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {sub.square_url}
                  </a>
                  <p className="mt-1 text-xs text-muted">
                    Campaign {sub.campaign_id} · submitted {sub.created_at}
                  </p>
                  <input
                    type="text"
                    value={notes[sub.id] ?? ""}
                    onChange={(e) =>
                      setNotes({ ...notes, [sub.id]: e.target.value })
                    }
                    placeholder="Review note (shown to the submitter on reject)"
                    className="mt-3 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onReview(sub, "approve")}
                      disabled={reviewBusy !== null}
                      className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
                    >
                      {reviewBusy === sub.id + "approve"
                        ? "Approving…"
                        : "Approve & issue voucher"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onReview(sub, "reject")}
                      disabled={reviewBusy !== null}
                      className="rounded-md border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {reviewBusy === sub.id + "reject"
                        ? "Rejecting…"
                        : "Reject"}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
            {reviewError && (
              <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {reviewError}
              </p>
            )}
            {lastVoucher && (
              <Card>
                <SectionTitle>Voucher issued</SectionTitle>
                <p className="break-all font-mono text-xs text-zinc-200">
                  digest: {lastVoucher.digest}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Recipient {lastVoucher.recipient} · deadline{" "}
                  {new Date(lastVoucher.deadline * 1000).toISOString()} (1 h
                  max) · nonce {lastVoucher.nonce.slice(0, 18)}…
                </p>
              </Card>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>Audit log (hash-chained, append-only)</SectionTitle>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadAudit}
                  className="rounded-md border border-gold/60 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/10"
                >
                  Load log
                </button>
                <button
                  type="button"
                  onClick={onVerifyAudit}
                  className="rounded-md border border-gold/60 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/10"
                >
                  Verify chain
                </button>
              </div>
            </div>
            {auditError && (
              <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {auditError}
              </p>
            )}
            {auditValid && (
              <p className="mt-3 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
                {auditValid}
              </p>
            )}
            {audit.length > 0 && (
              <Card>
                <ul className="space-y-2 text-sm">
                  {audit.slice(0, 20).map((e) => (
                    <li
                      key={e.id}
                      className="border-b border-line pb-2 last:border-0"
                    >
                      <span className="font-semibold text-white">
                        #{e.id} {e.action}
                      </span>{" "}
                      <span className="text-muted">
                        by {e.actor} · {e.created_at}
                      </span>
                      <span className="block break-all font-mono text-xs text-muted">
                        {e.detail ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>Mint audit — mints without a voucher</SectionTitle>
              <button
                type="button"
                onClick={loadMintAudit}
                className="rounded-md border border-gold/60 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/10"
              >
                Run mint audit
              </button>
            </div>
            {mintError && (
              <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {mintError}
              </p>
            )}
            {mintAudit && (
              <Card>
                <p className="text-sm text-zinc-200">
                  Checked {mintAudit.checked} Mint events from block{" "}
                  {mintAudit.fromBlock}: {mintAudit.matched.length} matched a
                  voucher,{" "}
                  <span className="font-semibold text-gold">
                    {mintAudit.unmatched.length} unmatched
                  </span>
                  .
                </p>
                {mintAudit.unmatched.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm">
                    {mintAudit.unmatched.map((m) => (
                      <li
                        key={m.txHash}
                        className="border-b border-line pb-2 last:border-0"
                      >
                        <span className="font-semibold text-white">
                          token #{m.tokenId}
                        </span>{" "}
                        <span className="break-all font-mono text-xs text-muted">
                          {m.recipient}
                        </span>{" "}
                        <span className="font-mono text-xs text-gold">
                          {m.txHash.slice(0, 10)}…{m.txHash.slice(-8)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </section>
        </>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>Admin CAN</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            <li>Approve or reject a submission after reading the Square post.</li>
            <li>Sign claim vouchers (automatic on approval, bound to the submitter&apos;s wallet, 1 h max).</li>
            <li>Rotate the voucher signer key if it is ever compromised.</li>
            <li>Change the NFT metadata base URI.</li>
            <li>Pause minting in an emergency (pause stops minting; it does not change supply).</li>
          </ul>
        </Card>
        <Card>
          <SectionTitle>Admin CANNOT</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            <li>Mint an NFT for anyone — minting only happens through the contract, by the voucher holder.</li>
            <li>Raise the 1,000 supply cap or bypass one-per-wallet.</li>
            <li>Move a voucher or change its recipient after it is signed.</li>
            <li>Change tracker numbers — the tracker reads the chain.</li>
            <li>Approve their own submission — a submission from the admin&apos;s own wallet is blocked server-side.</li>
            <li>See or store any user&apos;s private key — the backend never receives one.</li>
          </ul>
        </Card>
      </section>

      <HonestNote>
        Every admin decision is written to an append-only, hash-chained audit
        log. The log has no edit or delete path — by design.
      </HonestNote>
    </div>
  );
}
