import { env } from "../config/env.js";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return env.adminEmails.includes(normalized);
}
