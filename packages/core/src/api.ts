// Shapes exchanged between apps/api and apps/web.

import type { Creature, CreatureInput, CreatureStatus } from "./creature";

export interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface MeResponse {
  user: PublicUser | null;
}

export interface HealthResponse {
  status: "ok";
  database: "ok" | "error";
}

export interface TribeSummary {
  id: string;
  name: string;
  isOwner: boolean;
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

export interface UpdateCreatureRequest {
  name?: string;
  status?: CreatureStatus;
}
