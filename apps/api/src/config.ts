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
