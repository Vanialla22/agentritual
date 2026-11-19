import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "./config";
import { getDb, migrate } from "./db";
import { backfillAuditLogChain } from "./auditLog";
import { registerAdminRoutes } from "./routes/admin";
import { registerAuthRoutes } from "./routes/auth";
import { registerEligibilityRoutes } from "./routes/eligibility";
import { registerMetadataRoutes } from "./routes/metadata";
import { registerSubmissionRoutes } from "./routes/submissions";
import { registerTrackerRoutes } from "./routes/tracker";

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.corsOrigins });

  const db = getDb();
  await migrate(db);
  // Chain any audit-log rows written before Phase 4 (migration 004).
  const backfilled = await backfillAuditLogChain(db);
  if (backfilled > 0) {
    app.log.info(`audit_log: backfilled hash chain for ${backfilled} rows`);
  }
  if (!config.adminWallet) {
    app.log.warn(
      "ADMIN_WALLET is not set — the self-approval block is INACTIVE. " +
        "Set it to the admin wallet address to block self-review.",
    );
  }
  if (!config.adminPasswordHash || !config.adminSessionSecret) {
    app.log.warn(
      "admin login is not fully configured (ADMIN_PASSWORD_HASH / " +
        "ADMIN_SESSION_SECRET) — POST /api/admin/login will fail closed.",
    );
  }

  app.get("/api/health", async () => ({
    ok: true,
    service: "agentritual-api",
    time: new Date().toISOString(),
  }));

  registerSubmissionRoutes(app, db);
  registerEligibilityRoutes(app);
  registerTrackerRoutes(app);
  registerMetadataRoutes(app);
  registerAuthRoutes(app);
  registerAdminRoutes(app, db);

  return app;
}
