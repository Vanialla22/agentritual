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
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
