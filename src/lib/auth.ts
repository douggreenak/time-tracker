import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import type { UserItem } from "@/db/mock-data";

export const SESSION_COOKIE = "tt_session";
const SESSION_DAYS = 14;

/** Signing key: AUTH_SECRET, else derived from DATABASE_URL, else a random key kept in .data/. */
function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.DATABASE_URL) return createHash("sha256").update(`tt-session|${process.env.DATABASE_URL}`).digest("hex");
  const g = globalThis as unknown as { __ttSecret?: string };
  if (g.__ttSecret) return g.__ttSecret;
  const dir = ".data";
  const file = `${dir}/auth-secret`;
  try {
    if (existsSync(file)) g.__ttSecret = readFileSync(file, "utf8").trim();
    else {
      mkdirSync(dir, { recursive: true });
      g.__ttSecret = randomBytes(32).toString("hex");
      writeFileSync(file, g.__ttSecret, { mode: 0o600 });
    }
  } catch {
    g.__ttSecret = randomBytes(32).toString("hex"); // read-only disk: sessions last until restart
  }
  return g.__ttSecret!;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionToken(userId: string): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const mac = Buffer.from(token.slice(i + 1));
  const good = Buffer.from(sign(payload));
  if (mac.length !== good.length || !timingSafeEqual(mac, good)) return null;
  const [userId, exp] = payload.split(".");
  return userId && Number(exp) > Date.now() ? userId : null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  };
}

/** The signed-in user (looked up fresh, so role changes apply immediately), or null. */
export async function currentUser(): Promise<UserItem | null> {
  const id = readSessionToken(cookies().get(SESSION_COOKIE)?.value);
  return id ? (await dataStore.getUserById(id)) ?? null : null;
}

export const isAdmin = (u: Pick<UserItem, "role">) => u.role === "admin";
export const isManager = (u: Pick<UserItem, "role">) => u.role === "accountant" || u.role === "admin";

type Guard = { ok: true; user: UserItem } | { ok: false; res: NextResponse };

/** Use at the top of an API handler: `const g = await requireUser(); if (!g.ok) return g.res;` */
export async function requireUser(opts: { manager?: boolean; admin?: boolean } = {}): Promise<Guard> {
  const user = await currentUser();
  if (!user) return { ok: false, res: NextResponse.json({ success: false, error: "Please sign in." }, { status: 401 }) };
  if (opts.admin && !isAdmin(user))
    return { ok: false, res: NextResponse.json({ success: false, error: "Only an admin can do that." }, { status: 403 }) };
  if (opts.manager && !isManager(user))
    return { ok: false, res: NextResponse.json({ success: false, error: "Only an accountant or admin can do that." }, { status: 403 }) };
  return { ok: true, user };
}

// Slow down password guessing: 5 misses locks that person for a minute.
const attempts = new Map<string, { n: number; until: number }>();
export function loginThrottle(userId: string) {
  const a = attempts.get(userId);
  return a && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}
export function recordLogin(userId: string, ok: boolean) {
  if (ok) return void attempts.delete(userId);
  const a = attempts.get(userId) ?? { n: 0, until: 0 };
  a.n += 1;
  if (a.n >= 5) {
    a.n = 0;
    a.until = Date.now() + 60_000;
  }
  attempts.set(userId, a);
}
