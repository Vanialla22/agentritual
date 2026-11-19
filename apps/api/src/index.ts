import { config } from "./config";
import { buildServer } from "./server";

async function main() {
  const app = await buildServer();
  await app.listen({ host: "0.0.0.0", port: config.port });
  app.log.info(`agentritual-api listening on :${config.port}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
