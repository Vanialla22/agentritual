import type { FastifyInstance } from "fastify";

/**
 * Admin endpoints — STUBS in Phase 1.
 * Admin authentication, review, and audit-log writes ship in Phase 4.
 * These routes intentionally return 501 rather than a fake implementation.
 */
export function registerAdminRoutes(app: FastifyInstance) {
  app.post("/api/admin/login", async (_req, reply) => {
    return reply.status(501).send({
      error: "not implemented in Phase 1 — admin auth ships in Phase 4",
    });
  });

  app.post("/api/admin/review", async (_req, reply) => {
    return reply.status(501).send({
      error: "not implemented in Phase 1 — admin review ships in Phase 4",
    });
  });
}
