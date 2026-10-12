import type { MeResponse, PublicUser } from "@ark-breeding/core";

// The API lives on the same origin (/api), so cookies travel without any CORS setup.
export async function fetchCurrentUser(): Promise<PublicUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!res.ok) return null;
  const data: MeResponse = await res.json();
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
}

export const DISCORD_LOGIN_URL = "/api/auth/discord/login";
