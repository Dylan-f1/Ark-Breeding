import {
  ACCOUNT_DELETION_WORD,
  MAX_CREATURES_PER_SAVE,
  type Creature,
  type CreatureInput,
  type LibraryResponse,
  type MeResponse,
  type PublicUser,
  type SaveCreaturesResponse,
  type UpdateCreatureRequest,
  type InvitePreview,
  type ServerSettings,
  type TribeDetail,
  type TribeSummary,
  type TribesResponse,
  type RecomputeLevelsRequest,
  type SharedServer,
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

// Notices (tribe deleted, excluded…) are shown once, then acknowledged.
export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  return res.ok ? res.json() : { user: null, notices: [] };
}
export const acknowledgeNotices = () => request<void>("/auth/notices", { method: "DELETE" });

// Tribes (J4)
export const fetchTribes = () => request<TribesResponse>("/tribes");
export const fetchCurrentTribe = () => request<TribeDetail>("/tribes/current");
export const createTribe = (name: string) => request<TribeSummary>("/tribes", { method: "POST", body: JSON.stringify({ name }) });
export const switchTribe = (tribeId: string) =>
  request<void>("/tribes/current", { method: "PUT", body: JSON.stringify({ tribeId }) });
export const renameTribe = (name: string) =>
  request<TribeDetail>("/tribes/current", { method: "PATCH", body: JSON.stringify({ name }) });
export const saveServerSettings = (settings: ServerSettings) =>
  request<TribeDetail>("/tribes/current/settings", { method: "PUT", body: JSON.stringify(settings) });
export const regenerateInvite = () => request<TribeDetail>("/tribes/current/invite", { method: "POST" });
export const fetchInvite = (code: string) => request<InvitePreview>(`/tribes/invite/${encodeURIComponent(code)}`);
export const joinTribe = (code: string) => request<TribeSummary>("/tribes/join", { method: "POST", body: JSON.stringify({ code }) });
export const excludeMember = (userId: string) =>
  request<TribeDetail>(`/tribes/current/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
export const leaveTribe = () => request<void>("/tribes/current/leave", { method: "POST" });
export const transferTribe = (userId: string) =>
  request<TribeDetail>("/tribes/current/transfer", { method: "POST", body: JSON.stringify({ userId }) });
export const deleteTribe = (confirmName: string) =>
  request<void>("/tribes/current", { method: "DELETE", body: JSON.stringify({ confirmName }) });

export type LevelsUpdate = RecomputeLevelsRequest["creatures"][number];
/** EF-05: saves re-extracted levels in chunks; the last one records the settings fingerprint. */
export async function saveRecomputedLevels(creatures: LevelsUpdate[], fingerprint: string) {
  let i = 0;
  do {
    const chunk = creatures.slice(i, i + MAX_CREATURES_PER_SAVE);
    i += MAX_CREATURES_PER_SAVE;
    await request<void>("/creatures/levels", {
      method: "PUT",
      body: JSON.stringify({ creatures: chunk, ...(i >= creatures.length ? { fingerprint } : {}) }),
    });
  } while (i < creatures.length);
}

/** EF-20 */
export const deleteAccount = () =>
  request<void>("/auth/account", { method: "DELETE", body: JSON.stringify({ confirm: ACCOUNT_DELETION_WORD }) });

// Shared servers (EF-27 / EF-28)
export const fetchServers = () => request<SharedServer[]>("/servers");
export const publishServer = (name: string, settings: ServerSettings) =>
  request<{ id: string }>("/servers", { method: "POST", body: JSON.stringify({ name, settings }) });
export const updateServer = (id: string, patch: { name?: string; settings?: ServerSettings }) =>
  request<void>(`/servers/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const deleteServer = (id: string) => request<void>(`/servers/${id}`, { method: "DELETE" });
export const followServer = (serverId: string) =>
  request<TribeDetail>("/tribes/current/settings", { method: "PUT", body: JSON.stringify({ serverId }) });
