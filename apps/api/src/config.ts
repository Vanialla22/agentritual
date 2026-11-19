export const config = {
  port: Number(process.env.PORT ?? 3001),
  databasePath: process.env.DATABASE_PATH ?? "./data/agentritual.db",
  tursoUrl: process.env.TURSO_DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
  bscRpcUrl: process.env.BSC_RPC_URL ?? "https://bsc.publicnode.com",
  nftContractAddress: process.env.NFT_CONTRACT_ADDRESS ?? "",
  nftImageUrl: process.env.NFT_IMAGE_URL ?? "",
  adminSignerKey: process.env.ADMIN_SIGNER_PRIVATE_KEY ?? "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
