import { ethers } from "ethers";
import { config, isAuthorizedCampaign } from "./config";

/**
 * EIP-712 claim voucher (Phase 2 contract verifies this exact shape).
 *
 * The voucher binds ONE wallet: the Agent ID owner, the voucher recipient,
 * and the future NFT recipient must all be the same address — the contract
 * enforces recipient == msg.sender, and the backend only signs vouchers for
 * the wallet that submitted the proof.
 *
 * The signing key belongs to the PROJECT (an admin signer created for this
 * project). It is never a user's key. It must come from the
 * ADMIN_SIGNER_PRIVATE_KEY env var. If the var is absent, signing is
 * unavailable and any voucher endpoint fails with 503 — no fallback key is
 * ever generated or committed.
 */
export interface ClaimVoucher {
  campaignId: number;
  recipient: string;
  deadline: number;
  /**
   * bytes32 nonce (32-byte hex, e.g. ethers.randomBytes(32)).
   * MUST be bytes32: the contract's VOUCHER_TYPEHASH is
   * ClaimVoucher(...,bytes32 nonce) — a uint256 nonce encodes
   * differently and the signature would recover to a wrong address
   * on-chain (audit M-1).
   */
  nonce: string;
}

export const VOUCHER_TYPES = {
  ClaimVoucher: [
    { name: "campaignId", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

/** Generate a fresh random bytes32 nonce for a voucher. */
export function newVoucherNonce(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

export function getVoucherDomain(): {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
} {
  if (!config.nftContractAddress) {
    throw new Error("voucher signing not configured");
  }
  return {
    // Audit M-2: chainId comes from env (NFT_CHAIN_ID, default 97
    // testnet). The contract's EIP-712 domain uses block.chainid, so a
    // hardcoded value would make vouchers for the other chain revert.
    chainId: config.chainId,
    name: "AgentRitual",
    verifyingContract: config.nftContractAddress,
    version: "1",
  };
}

/** Returns the signer address, or null when signing is not configured. */
export function getSignerAddress(): string | null {
  if (!config.adminSignerKey) return null;
  try {
    return new ethers.Wallet(config.adminSignerKey).address;
  } catch {
    return null;
  }
}

/**
 * Maximum voucher lifetime: 24 hours by default (env
 * MAX_VOUCHER_TTL_SECONDS). The contract accepts any deadline, so the
 * backend is the enforcement point — no caller can issue a
 * longer-lived voucher through this function.
 */
export const MAX_VOUCHER_TTL_SECONDS = config.maxVoucherTtlSeconds;

/**
 * Sign a claim voucher. Throws "voucher signing not configured" when the
 * env var (or the contract address, needed for the EIP-712 domain) is
 * missing. Throws "voucher deadline exceeds maximum TTL" when the
 * deadline is not within the maximum TTL. Callers translate these into
 * HTTP 503 / 400.
 */
export async function signVoucher(voucher: ClaimVoucher): Promise<string> {
  if (!config.adminSignerKey) {
    throw new Error("voucher signing not configured");
  }
  // Campaign allowlist (hardening review H-6): no caller — not even the
  // admin review flow — can sign a voucher for an unauthorized campaign.
  if (!isAuthorizedCampaign(voucher.campaignId)) {
    throw new Error(`campaign ${voucher.campaignId} is not authorized`);
  }
  const now = Math.floor(Date.now() / 1000);
  if (
    voucher.deadline <= now ||
    voucher.deadline > now + MAX_VOUCHER_TTL_SECONDS
  ) {
    throw new Error("voucher deadline exceeds maximum TTL");
  }
  const domain = getVoucherDomain();
  const wallet = new ethers.Wallet(config.adminSignerKey);
  return wallet.signTypedData(domain, VOUCHER_TYPES, {
    campaignId: voucher.campaignId,
    deadline: voucher.deadline,
    nonce: voucher.nonce,
    recipient: voucher.recipient,
  });
}

export interface BuiltVoucher {
  campaignId: number;
  deadline: number;
  digest: string;
  nonce: string;
  recipient: string;
  signature: string;
}

/**
 * Sign a claim voucher for a wallet + campaign and return everything a
 * caller needs to store it (signature + digest). Pure signing — touches
 * no database, so callers sign BEFORE consuming a proof token or
 * inserting a row: a signing failure then leaves no state behind and
 * the user can retry. Used by the admin review flow and by
 * auto-approve at submit time; both paths issue the identical voucher.
 */
export async function buildVoucher(
  wallet: string,
  campaignId: number,
): Promise<BuiltVoucher> {
  if (!config.adminSignerKey || !config.nftContractAddress) {
    throw new Error("voucher signing not configured");
  }
  if (!Number.isSafeInteger(campaignId)) {
    throw new Error("campaign_id is not a valid number");
  }
  const deadline = Math.floor(Date.now() / 1000) + MAX_VOUCHER_TTL_SECONDS;
  const nonce = newVoucherNonce();
  const signature = await signVoucher({
    campaignId,
    deadline,
    nonce,
    recipient: wallet,
  });
  const domain = getVoucherDomain();
  const digest = ethers.TypedDataEncoder.hash(domain, VOUCHER_TYPES, {
    campaignId,
    deadline,
    nonce,
    recipient: wallet,
  });
  return {
    campaignId,
    deadline,
    digest,
    nonce,
    recipient: wallet,
    signature,
  };
}
