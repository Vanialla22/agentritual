const raw = import.meta.env.VITE_API_URL as string | undefined;

export const API_URL = (raw ?? "http://localhost:3001").replace(/\/$/, "");

export interface TrackerData {
  contractAddress: string;
  chainId: number;
  chainName: string;
  totalSupply: number;
  maxSupply: number;
  remaining: number;
  recentMints: Array<{
    tokenId: number;
    minter: string;
    txHash: string;
    blockNumber: number;
    timestamp: string | null;
  }>;
}

export interface Submission {
  id: string;
  wallet: string;
  square_url: string;
  campaign_id: string;
  status: string;
  created_at: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export interface Eligibility {
  address: string;
  hasAgentId: boolean;
  registry: string;
}

export function fetchEligibility(address: string): Promise<Eligibility> {
  return api<Eligibility>(
    `/api/eligibility?address=${encodeURIComponent(address)}`,
  );
}

export function fetchTracker(): Promise<TrackerData> {
  return api<TrackerData>("/api/tracker");
}

export function fetchSubmission(id: string): Promise<Submission> {
  return api<Submission>(`/api/submissions/${encodeURIComponent(id)}`);
}

export function submitProof(input: {
  wallet: string;
  squareUrl: string;
  campaignId: string;
  proofToken?: string;
}): Promise<Submission> {
  return api<Submission>("/api/submissions", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export interface Challenge {
  address: string;
  message: string;
  expiresAt: string;
  tag: string;
}

export function fetchChallenge(address: string): Promise<Challenge> {
  return api<Challenge>(
    `/api/auth/challenge?address=${encodeURIComponent(address)}`,
  );
}

export function verifyChallenge(input: {
  address: string;
  message: string;
  tag: string;
  signature: string;
}): Promise<{ address: string; proofToken: string }> {
  return api<{ address: string; proofToken: string }>("/api/auth/verify", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

// --- Admin (token kept in memory only, never localStorage) ---

export interface AdminSubmission extends Submission {
  review_note: string | null;
  reviewed_at: string | null;
}

export interface Voucher {
  campaignId: number;
  recipient: string;
  deadline: number;
  nonce: string;
  signature: string;
  digest: string;
}

export async function adminLogin(password: string): Promise<string> {
  const res = await api<{ token: string }>("/api/admin/login", {
    body: JSON.stringify({ password }),
    method: "POST",
  });
  return res.token;
}

function adminHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function fetchAdminSubmissions(
  token: string,
  status?: string,
): Promise<{ items: AdminSubmission[] }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return api<{ items: AdminSubmission[] }>(`/api/admin/submissions${q}`, {
    headers: adminHeaders(token),
  });
}

export function adminReview(
  token: string,
  input: { submissionId: string; decision: "approve" | "reject"; note?: string },
): Promise<{ id: string; status: string; voucher?: Voucher; note?: string | null }> {
  return api("/api/admin/review", {
    body: JSON.stringify(input),
    headers: adminHeaders(token),
    method: "POST",
  });
}

export interface AuditLogEntry {
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

export function fetchAuditLog(
  token: string,
): Promise<{ items: AuditLogEntry[] }> {
  return api<{ items: AuditLogEntry[] }>("/api/admin/audit-log", {
    headers: adminHeaders(token),
  });
}

export function verifyAuditLog(
  token: string,
  expected?: { expectedLatest?: string; expectedCount?: number },
): Promise<{
  valid: boolean;
  checked: number;
  firstBadIndex?: number;
  latestEntryHash: string | null;
  latestSeq: number | null;
  checkpointMatch: boolean | null;
}> {
  const q = expected
    ? `?${new URLSearchParams({
        ...(expected.expectedLatest
          ? { expectedLatest: expected.expectedLatest }
          : {}),
        ...(expected.expectedCount !== undefined
          ? { expectedCount: String(expected.expectedCount) }
          : {}),
      }).toString()}`
    : "";
  return api(`/api/admin/audit-log/verify${q}`, {
    headers: adminHeaders(token),
  });
}

export function fetchAuditCheckpoint(
  token: string,
): Promise<{
  checked: number;
  computedAt: string;
  latestEntryHash: string | null;
  latestSeq: number | null;
  valid: boolean;
}> {
  return api("/api/admin/audit-log/checkpoint", {
    headers: adminHeaders(token),
  });
}

export async function adminLogout(token: string): Promise<void> {
  await api("/api/admin/logout", {
    body: JSON.stringify({}),
    headers: adminHeaders(token),
    method: "POST",
  });
}

export interface MintAuditEntry {
  blockNumber: number;
  campaignId: number;
  tokenId: number;
  recipient: string;
  txHash: string;
  classification: "matched" | "known-test" | "anomaly";
  match: {
    submissionId: string;
    voucherDigest: string;
    approvedAt: string | null;
  } | null;
}

export function fetchMintAudit(
  token: string,
): Promise<{
  checked: number;
  matched: MintAuditEntry[];
  unmatched: MintAuditEntry[];
  knownTest: MintAuditEntry[];
  anomalies: MintAuditEntry[];
  fromBlock: number;
}> {
  return api("/api/admin/mint-audit", {
    headers: adminHeaders(token),
  });
}
