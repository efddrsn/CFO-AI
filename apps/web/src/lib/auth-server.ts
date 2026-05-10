/**
 * Node-only auth helpers (bcrypt). Importe apenas em route handlers/server
 * components — nunca no middleware (Edge Runtime).
 */
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
