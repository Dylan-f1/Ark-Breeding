import type { Context } from "hono";

/** Any schema from @ark-breeding/core (zod lives there, not in the API). */
interface Schema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export async function parseBody<T>(c: Context, schema: Schema<T>): Promise<T | null> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}
