// Server settings of a tribe (EF-05): stat multipliers + max wild level.

import { z } from "zod";
import { OFFICIAL_SERVER_MULTIPLIERS, type ServerMultipliers, type StatMultipliers } from "./species";
import { STATS_COUNT } from "./stats";

export interface ServerSettings {
  multipliers: ServerMultipliers;
  /** Highest wild level (official ASA: 150). */
  maxWildLevel: number;
}

export const OFFICIAL_SERVER_SETTINGS: ServerSettings = {
  multipliers: OFFICIAL_SERVER_MULTIPLIERS,
  maxWildLevel: 150,
};

const multiplier = z.number().finite().min(0).max(1000);

export const serverSettingsSchema = z.object({
  multipliers: z.object({
    statMultipliers: z.array(z.tuple([multiplier, multiplier, multiplier, multiplier]).nullable()).length(STATS_COUNT),
    babyImprintingStatScaleMultiplier: multiplier,
    babyImprintAmountMultiplier: multiplier.positive(),
    babyCuddleIntervalMultiplier: multiplier.positive(),
    babyMatureSpeedMultiplier: multiplier.positive(),
    eggHatchSpeedMultiplier: multiplier.positive(),
    matingIntervalMultiplier: multiplier.positive(),
    allowSpeedLeveling: z.boolean(),
    allowFlyerSpeedLeveling: z.boolean(),
  }),
  maxWildLevel: z.number().int().min(1).max(10_000),
}) satisfies z.ZodType<ServerSettings>;

export function isOfficialSettings(settings: ServerSettings): boolean {
  return JSON.stringify(settings) === JSON.stringify(OFFICIAL_SERVER_SETTINGS);
}

/** Index in StatMultipliers ([tamingAdd, tamingMult, levelDom, levelWild]) for each ini key prefix. */
const STAT_KEYS: [RegExp, number][] = [
  [/^PerLevelStatsMultiplier_DinoTamed_Add\[(\d+)\]$/i, 0],
  [/^PerLevelStatsMultiplier_DinoTamed_Affinity\[(\d+)\]$/i, 1],
  [/^PerLevelStatsMultiplier_DinoTamed\[(\d+)\]$/i, 2],
  [/^PerLevelStatsMultiplier_DinoWild\[(\d+)\]$/i, 3],
];

const NUMBER_KEYS = {
  babyimprintingstatscalemultiplier: "babyImprintingStatScaleMultiplier",
  babyimprintamountmultiplier: "babyImprintAmountMultiplier",
  babycuddleintervalmultiplier: "babyCuddleIntervalMultiplier",
  babymaturespeedmultiplier: "babyMatureSpeedMultiplier",
  egghatchspeedmultiplier: "eggHatchSpeedMultiplier",
  matingintervalmultiplier: "matingIntervalMultiplier",
} as const;

const BOOLEAN_KEYS = {
  allowspeedleveling: "allowSpeedLeveling",
  allowflyerspeedleveling: "allowFlyerSpeedLeveling",
} as const;

/**
 * Reads the breeding-related lines of Game.ini / GameUserSettings.ini. Anything not set keeps
 * the official value, like on the server itself. Returns the recognised keys.
 */
export function parseServerIni(text: string): { settings: ServerSettings; recognized: string[] } {
  const settings: ServerSettings = structuredClone(OFFICIAL_SERVER_SETTINGS);
  const m = settings.multipliers;
  const recognized: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq === -1 || line.trimStart().startsWith(";")) continue;
    const key = line.slice(0, eq).trim();
    const raw = line.slice(eq + 1).trim();
    const value = Number.parseFloat(raw);

    const stat = STAT_KEYS.find(([re]) => re.test(key));
    if (stat) {
      const index = Number(key.match(stat[0])![1]);
      if (index >= STATS_COUNT || !Number.isFinite(value) || value < 0) continue;
      const current: StatMultipliers = [...(m.statMultipliers[index] ?? [1, 1, 1, 1])];
      current[stat[1]] = value;
      m.statMultipliers[index] = current;
      recognized.push(key);
      continue;
    }

    const lower = key.toLowerCase();
    if (lower in NUMBER_KEYS && Number.isFinite(value) && value > 0) {
      m[NUMBER_KEYS[lower as keyof typeof NUMBER_KEYS]] = value;
      recognized.push(key);
    } else if (lower in BOOLEAN_KEYS) {
      m[BOOLEAN_KEYS[lower as keyof typeof BOOLEAN_KEYS]] = /^true$/i.test(raw);
      recognized.push(key);
    } else if (lower === "overrideofficialdifficulty" && Number.isFinite(value) && value > 0) {
      // the max wild level is 30 × the difficulty (5 → 150)
      settings.maxWildLevel = Math.round(value * 30);
      recognized.push(key);
    }
  }
  return { settings, recognized };
}

/** Same settings ⇒ same string, whatever the key order (canonical JSON). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

/**
 * Fingerprint of the settings a library's levels were computed with: when the tribe's settings
 * change (e.g. its shared server was edited), the levels are recomputed.
 */
export function settingsFingerprint(settings: ServerSettings): string {
  const text = canonical(settings);
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// EF-27 / EF-28: servers shared between tribes
export const serverNameSchema = z.string().trim().min(3).max(60);
export const publishServerSchema = z.object({ name: serverNameSchema, settings: serverSettingsSchema });
export const updateServerSchema = z.object({ name: serverNameSchema, settings: serverSettingsSchema }).partial();
/** A tribe either follows a shared server or has its own settings. */
export const tribeSettingsSchema = z.union([z.object({ serverId: z.string().uuid() }), serverSettingsSchema]);
