import { getDb, migrate } from "../db";

async function main() {
  const db = getDb();
  const applied = await migrate(db);
  if (applied.length === 0) {
    console.log("migrations: nothing to apply (already up to date)");
  } else {
    console.log(`migrations applied: ${applied.join(", ")}`);
  }
  await db.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
