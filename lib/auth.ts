import "server-only";
import { createHash } from "node:crypto";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { cache } from "react";

export type SessionData = {
  isAdmin?: boolean;
  loginAt?: number;
};

function getSessionPassword(): string {
  const pwd = process.env.SESSION_PASSWORD;
  if (process.env.NODE_ENV === "production") {
    if (!pwd || pwd.length < 32) {
      throw new Error(
        "SESSION_PASSWORD env var is required in production and must be at least 32 characters. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    return pwd;
  }
  return pwd || "dev_password_min_32_chars_change_me_please_xx";
}

export const sessionOptions: SessionOptions = {
  password: getSessionPassword(),
  cookieName: "lomba_kampung_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
};

export const getSession = cache(async () => {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  return session;
});

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session.isAdmin;
}

// Simple SHA256-based verification (prototype only)
// TODO: replace with bcrypt when build tools available
export function hashPassword(password: string): string {
  return "sha256$" + createHash("sha256").update(password + "lomba_salt_2026").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
