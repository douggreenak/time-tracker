import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";

const scrypt = (pw: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((resolve, reject) => _scrypt(pw, salt, len, (e, k) => (e ? reject(e) : resolve(k))));

/** scrypt, stored as "salt:hash" (hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
