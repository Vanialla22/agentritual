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

export function fetchTracker(): Promise<TrackerData> {
  return api<TrackerData>("/api/tracker");
}

export function submitProof(input: {
  wallet: string;
  squareUrl: string;
  campaignId: string;
}): Promise<Submission> {
  return api<Submission>("/api/submissions", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export function fetchSubmission(id: string): Promise<Submission> {
  return api<Submission>(`/api/submissions/${encodeURIComponent(id)}`);
}
