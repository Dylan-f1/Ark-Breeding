// Shapes exchanged between apps/api and apps/web.

import type { Creature, CreatureInput } from "./creature";
import type { ServerSettings } from "./server-settings";

export interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Notice {
  id: string;
  message: string;
  createdAt: string;
}

export interface MeResponse {
  user: PublicUser | null;
  /** Messages to show once (tribe deleted, excluded…). */
  notices: Notice[];
}

export interface HealthResponse {
  status: "ok";
  database: "ok" | "error";
}

export interface TribeSummary {
  id: string;
  name: string;
  isOwner: boolean;
  /** Effective settings: the shared server's if the tribe follows one (EF-27). */
  settings: ServerSettings;
  server: { id: string; name: string; isMine: boolean } | null;
  /** settingsFingerprint() of the settings the library levels were computed with; null = unknown. */
  levelsFingerprint: string | null;
}

export interface SharedServer {
  id: string;
  name: string;
  ownerName: string | null;
  isMine: boolean;
  tribeCount: number;
  settings: ServerSettings;
  updatedAt: string;
}

export interface TribesResponse {
  current: TribeSummary;
  tribes: TribeSummary[];
}

export interface TribeMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isOwner: boolean;
  joinedAt: string;
}

export interface TribeDetail extends TribeSummary {
  members: TribeMember[];
  /** Current invitation (EF-04); null when expired or never created. */
  invite: { code: string; expiresAt: string } | null;
  creatureCount: number;
}

export interface InvitePreview {
  tribeName: string;
  memberCount: number;
  expired: boolean;
  alreadyMember: boolean;
}

export interface LibraryResponse {
  tribe: TribeSummary;
  creatures: Creature[];
}

export interface SaveCreaturesRequest {
  creatures: CreatureInput[];
}

export interface SaveCreaturesResponse {
  created: number;
  /** Creatures already in the library (same in-game id) that were refreshed. */
  updated: number;
  creatures: Creature[];
}

export type UpdateCreatureRequest = Partial<
  Pick<Creature, "name" | "status" | "sex" | "mutationsMother" | "mutationsFather" | "motherId" | "fatherId">
>;
