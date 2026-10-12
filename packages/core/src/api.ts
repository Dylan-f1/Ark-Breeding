// Shapes exchanged between apps/api and apps/web.

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
