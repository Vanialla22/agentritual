import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "./config";
import { getDb, migrate } from "./db";
import { registerAdminRoutes } from "./routes/admin";
import { registerEligibilityRoutes } from "./routes/eligibility";
import { registerMetadataRoutes } from "./routes/metadata";
import { registerSubmissionRoutes } from "./routes/submissions";
import { registerTrackerRoutes } from "./routes/tracker";

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.corsOrigins });

  const db = getDb();
  await migrate(db);

  app.get("/api/health", async () => ({
    ok: true,
    service: "agentritual-api",
    time: new Date().toISOString(),
  }));

  registerSubmissionRoutes(app, db);
  registerEligibilityRoutes(app);
  registerTrackerRoutes(app);
  registerMetadataRoutes(app);
  registerAdminRoutes(app);

  return app;
}
