import {
  MAX_CREATURES_PER_SAVE,
  type Creature,
  type CreatureInput,
  type LibraryResponse,
  type MeResponse,
  type PublicUser,
  type SaveCreaturesResponse,
  type UpdateCreatureRequest,
} from "@ark-breeding/core";

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

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`API ${status}: ${code}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? "unknown_error");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const fetchLibrary = () => request<LibraryResponse>("/creatures");

/** Saves in chunks of MAX_CREATURES_PER_SAVE (a full DinoExports folder can be large). */
export async function saveCreatures(creatures: CreatureInput[]) {
  const total = { created: 0, updated: 0, creatures: [] as Creature[] };
  for (let i = 0; i < creatures.length; i += MAX_CREATURES_PER_SAVE) {
    const res = await request<SaveCreaturesResponse>("/creatures", {
      method: "POST",
      body: JSON.stringify({ creatures: creatures.slice(i, i + MAX_CREATURES_PER_SAVE) }),
    });
    total.created += res.created;
    total.updated += res.updated;
    total.creatures.push(...res.creatures);
  }
  return total;
}

export const updateCreature = (id: string, patch: UpdateCreatureRequest) =>
  request<Creature>(`/creatures/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteCreature = (id: string) => request<void>(`/creatures/${id}`, { method: "DELETE" });
