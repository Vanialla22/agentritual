export const config = {
  port: Number(process.env.PORT ?? 3001),
  databasePath: process.env.DATABASE_PATH ?? "./data/agentritual.db",
  tursoUrl: process.env.TURSO_DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
  bscRpcUrl: process.env.BSC_RPC_URL ?? "https://bsc.publicnode.com",
  // Chain the API talks to. 97 = BSC testnet (default), 56 = BSC mainnet.
  // The EIP-712 voucher domain MUST use this chainId — the contract's
  // domain is built from block.chainid (audit M-2: a hardcoded 56 makes
  // every testnet voucher revert InvalidSigner on-chain).
  chainId: Number(process.env.NFT_CHAIN_ID ?? 97),
  nftContractAddress: process.env.NFT_CONTRACT_ADDRESS ?? "",
  // Agent ID registry the API checks balanceOf against. Mainnet:
  // 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F. Testnet: the mock
  // registry address from the Phase 2 deployment. Empty = eligibility
  // checks fail closed with 503 (never silently skipped).
  agentIdRegistryAddress: process.env.AGENT_ID_REGISTRY_ADDRESS ?? "",
  nftImageUrl: process.env.NFT_IMAGE_URL ?? "",
  adminSignerKey: process.env.ADMIN_SIGNER_PRIVATE_KEY ?? "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  // Secret that HMAC-signs admin session tokens. Fail-closed: login
  // returns 503 when unset (see src/auth.ts).
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET ?? "",
  // Secret that HMAC-signs ownership-challenge tags and proof tokens.
  // Defaults to the admin session secret when unset; challenge endpoints
  // fail closed when neither is set.
  authSecret: process.env.AUTH_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? "",
  // The admin's own wallet (lowercase compare). When set, the review API
  // blocks the admin from approving/rejecting their own submission
  // (self-approval block, Phase 0 prototype flaw). Unset = the block is
  // inactive and the server logs a warning at startup.
  adminWallet: (process.env.ADMIN_WALLET ?? "").toLowerCase() || "",
  // Authorized campaigns (Phase 4 hardening review, finding H-6). Only
  // these campaign IDs can receive submissions, reviews, and vouchers.
  // Env is a comma-separated list, e.g. "001,002". Normalized to
  // 3-digit strings ("1" and "001" both mean campaign 001).
  authorizedCampaigns: (process.env.AUTHORIZED_CAMPAIGNS ?? "001")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => String(Number(s)).padStart(3, "0")),
  // Auto-approve (21 Nov 2026): when true (default), a submission that
  // passes every automated check is approved immediately with a signed
  // voucher — no admin review. Set AUTO_APPROVE=false to restore manual
  // review (pending submissions are then decided in the admin panel).
  // The automated checks are: valid proof token, valid Square URL,
  // Agent ID on-chain, no duplicate active submission, authorized
  // campaign. Post CONTENT is not checked by anyone when this is on.
  autoApprove: process.env.AUTO_APPROVE !== "false",
  // Historical test-mint tx hashes (Phase 2/3/4 e2e test mints: tokens
  // #0, #1, #2). GET /api/admin/mint-audit classifies these as
  // "known-test" instead of anomalies — they predate the voucher flow
  // (or were minted by test scripts) and have no voucher record in any
  // DB. Any OTHER mint without a voucher is an anomaly/alert.
  knownTestMintTxHashes: (
    process.env.KNOWN_TEST_MINT_TX_HASHES ??
    "0xf421e95f8e92e163fccc0364629befc2276369c787577db9eb0c36d121bf05cf,0x525948cc7f61bef95caa88cd71d981c3edc2aa45e2307f263fc723f5f9a44f0d,0xda53184dd618dd6ca95296205feb26ff626cd1b17ef9df9bde6a7c6ef0a576a2"
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  // First block of the NFT contract (Phase 2 testnet deploy: 143587234).
  // Used by GET /api/admin/mint-audit as the Mint-event scan start.
  // 0 = fall back to a trailing 5,000-block window.
  nftDeployBlock: Number(process.env.NFT_DEPLOY_BLOCK ?? 0),
  // Rate limits (env overrides for ops tuning / tests; defaults are the
  // documented Phase 4 limits). Values are counts per window.
  rateLimits: {
    submissionsPerWalletPerHour: Number(
      process.env.RATE_LIMIT_SUBMISSIONS_PER_WALLET_HOUR ?? 5,
    ),
    submissionsPerIpPerHour: Number(
      process.env.RATE_LIMIT_SUBMISSIONS_PER_IP_HOUR ?? 20,
    ),
    loginPerIpPer15Min: Number(
      process.env.RATE_LIMIT_LOGIN_PER_IP_15MIN ?? 5,
    ),
    eligibilityPerIpPerMin: Number(
      process.env.RATE_LIMIT_ELIGIBILITY_PER_IP_MIN ?? 60,
    ),
    challengePerIpPerMin: Number(
      process.env.RATE_LIMIT_CHALLENGE_PER_IP_MIN ?? 10,
    ),
  },
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

/** True when the campaign id (e.g. "001", "1", 1) is allowlisted. */
export function isAuthorizedCampaign(id: string | number): boolean {
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n < 0) return false;
  return config.authorizedCampaigns.includes(
    String(n).padStart(3, "0"),
  );
}
