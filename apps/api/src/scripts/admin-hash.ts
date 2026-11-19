import { hashAdminPassword } from "../auth";

/**
 * Generate an admin password hash for ADMIN_PASSWORD_HASH.
 *
 * Usage (never commit the password or the hash output to the repo):
 *
 *   ADMIN_PASSWORD='a-long-random-password' npm run admin:hash
 *
 * Copy the printed hash into the API env as ADMIN_PASSWORD_HASH.
 * The password itself is never stored anywhere — only the hash.
 */
function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error(
      "ADMIN_PASSWORD is not set. Run: ADMIN_PASSWORD='...' npm run admin:hash",
    );
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }
  console.log(hashAdminPassword(password));
}

main();
