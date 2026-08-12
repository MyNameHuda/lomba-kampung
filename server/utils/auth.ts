// Auth helpers — Nuxt 3 port of lib/auth.ts.
// iron-session replacement: useSession() from h3 (also sealed cookies).
//
// Differences vs Next.js version:
// - cookies() from next/headers → useSession(event, opts) from h3
// - getSession()/isAuthenticated() take H3 event instead of using cookies()
//   module-level caching (we use a wrapper that closes over the event)
import { type H3Event, createError } from "h3";
import { createHash } from "node:crypto";

export type SessionData = {
  isAdmin?: boolean;
  loginAt?: number;
};

const SESSION_COOKIE_NAME = "lomba_kampung_session";

function getSessionPassword(): string {
  const pwd = process.env.NUXT_SESSION_PASSWORD || "";
  if (process.env.NODE_ENV === "production") {
    if (!pwd || pwd.length < 32) {
      throw new Error(
        "NUXT_SESSION_PASSWORD env var is required in production and must be at least 32 characters. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    return pwd;
  }
  return pwd || "dev_password_min_32_chars_change_me_please_xx";
}

// Per-request admin session — wraps h3's useSession to bind it to the event.
// Renamed from getSession → getAdminSession to avoid clash with h3's own
// getSession export (Nuxt 3 auto-imports both, used to emit a warning).
export async function getAdminSession(event: H3Event) {
  const { useSession } = await import("h3");
  return await useSession<SessionData>(event, {
    password: getSessionPassword(),
    name: SESSION_COOKIE_NAME,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export async function isAuthenticated(event: H3Event): Promise<boolean> {
  const session = await getAdminSession(event);
  return !!session.data.isAdmin;
}

// Throw 401 if not authenticated. Use at the top of every admin API handler.
// Returns the session for convenience.
export async function requireAuth(event: H3Event) {
  const session = await getAdminSession(event);
  if (!session.data.isAdmin) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return session;
}

// SHA256-based password verification (prototype — same algo as Next port).
// TODO: replace with bcrypt when build tools available.
export function hashPassword(password: string): string {
  return "sha256$" + createHash("sha256").update(password + "lomba_salt_2026").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
