export type Mode = "testnet" | "mainnet";

export interface ModeInfo {
  apiUrl: string | undefined;
  chainId: number;
  chainName: string;
  contractAddress: string;
  registryAddress: string;
  explorerBase: string;
}

const MODE_STORAGE_KEY = "agentritual-mode";

// Single source of truth for per-mode config. apiUrl comes from env;
// the addresses are public on-chain values (already hardcoded elsewhere
// before this change — consolidated here, nothing new).
export const MODES: Record<Mode, ModeInfo> = {
  testnet: {
    apiUrl: import.meta.env.VITE_API_URL_TESTNET as string | undefined,
    chainId: 97,
    chainName: "BNB Smart Chain Testnet",
    contractAddress: "0xca998896041A761E315125cf42E8dBE8D3cE087C",
    registryAddress: "0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7",
    explorerBase: "https://testnet.bscscan.com",
  },
  mainnet: {
    apiUrl: import.meta.env.VITE_API_URL_MAINNET as string | undefined,
    chainId: 56,
    chainName: "BNB Smart Chain",
    contractAddress: "0x60153D5098EB900273164cb1f8623Fa91EC653B4",
    registryAddress: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
    explorerBase: "https://bscscan.com",
  },
};

/** Read the stored mode. Invalid / missing values fall back to mainnet:
    the live product is the default landing; Testnet stays one tap away
    in the header toggle, and a stored choice always wins. */
export function readMode(): Mode {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === "testnet" || stored === "mainnet") return stored;
    if (stored !== null) localStorage.removeItem(MODE_STORAGE_KEY);
  } catch {
    // storage unavailable (e.g. private mode) — fall through to default
  }
  return "mainnet";
}

let currentMode: Mode = readMode();

export function getMode(): Mode {
  return currentMode;
}

export function setMode(mode: Mode): void {
  currentMode = mode;
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // non-fatal: the mode still applies for this session
  }
}

/**
 * Base URL for the active mode, resolved at call time (not module load)
 * so switching modes takes effect immediately. Throws instead of silently
 * falling back to the other network's API — a missing env disables that
 * mode, it never mixes data between networks.
 */
export function getApiUrl(mode: Mode = currentMode): string {
  const url = MODES[mode].apiUrl?.replace(/\/$/, "");
  if (!url) {
    throw new Error(
      `API ${mode === "testnet" ? "Testnet" : "Mainnet"} belum dikonfigurasi (env VITE_API_URL_${mode.toUpperCase()} kosong)`,
    );
  }
  return url;
}

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
  // Present only when status === "approved" (GET /api/submissions/:id).
  voucher?: Voucher;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
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

export interface ChallengeTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: { wallet: string; nonce: string; expiresAt: number };
}

export interface Challenge {
  address: string;
  message: string;
  expiresAt: string;
  tag: string;
  // EIP-712 variant of the same challenge (BAW agents). Absent when the
  // API has no NFT contract configured — the text challenge still works.
  typedData?: ChallengeTypedData;
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
  // "eip191" (default, personal_sign) or "eip712" (BAW agents signing
  // the challenge's typedData). Omit for the text challenge.
  signType?: "eip191" | "eip712";
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
  // Only returned by POST /api/admin/review; GET /api/submissions/:id
  // omits it, so it must stay optional.
  digest?: string;
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
  latestBlock: number;
  // M-1 fix: true when NFT_DEPLOY_BLOCK is unset and the scan covered
  // only the trailing 5,000 blocks — a "0 anomalies" answer from a
  // truncated scan is NOT a clean bill.
  windowTruncated: boolean;
}> {
  return api("/api/admin/mint-audit", {
    headers: adminHeaders(token),
  });
}
