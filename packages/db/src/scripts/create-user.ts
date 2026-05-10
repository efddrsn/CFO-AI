import "dotenv/config";
import { db } from "../index.js";
import { users } from "../schema/users.js";
import bcrypt from "bcryptjs";

/**
 * Uso: tsx packages/db/src/scripts/create-user.ts <email> <password> [name]
 */
async function main() {
  const [, , email, password, name] = process.argv;
  if (!email || !password) {
    console.error("usage: create-user <email> <password> [name]");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name })
    .returning({ id: users.id, email: users.email });

  console.log(`Created user ${user!.email} (${user!.id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
