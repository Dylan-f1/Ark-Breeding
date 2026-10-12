import { STATS_COUNT, Stat } from "./stats";

/** [baseValue, incPerWildLevel, incPerDomLevel, addWhenTamed (Ta), multAffinity (Tm)] */
export type RawStat = number[];

/** One species as stored in data/species-asa.json (see scripts/build-species.mjs). */
export interface RawSpecies {
  blueprintPath: string;
  name: string;
  nameFemale?: string;
  nameMale?: string;
  variants?: string[];
  fullStatsRaw: (RawStat | null)[];
  altBaseStats?: Record<string, number>;
  displayedStats?: number;
  skipWildLevelStats: number;
  tamedBaseHealthMultiplier?: number;
  statImprintMult?: number[];
  mutationMult?: number[];
  statLevelUpsAdditive?: Record<string, boolean>;
  statCaps?: Record<string, number>;
  statNames?: Record<string, string>;
  isFlyer?: boolean;
  noGender?: boolean;
  matesWith?: string[];
  breeding?: {
    gestationTime: number;
    incubationTime: number;
    maturationTime: number;
    matingCooldownMin: number;
    matingCooldownMax: number;
    eggTempMin?: number;
    eggTempMax?: number;
  };
  colorRegions?: (string | null)[];
}

/** Per-stat multipliers: [tamingAdd, tamingMult, levelDom, levelWild] (ASB ServerMultipliers). */
export type StatMultipliers = [number, number, number, number];

export interface ServerMultipliers {
  statMultipliers: (StatMultipliers | null)[];
  babyImprintingStatScaleMultiplier: number;
  babyImprintAmountMultiplier: number;
  babyCuddleIntervalMultiplier: number;
  babyMatureSpeedMultiplier: number;
  eggHatchSpeedMultiplier: number;
  matingIntervalMultiplier: number;
  /** ASA server setting; off on official servers. */
  allowSpeedLeveling: boolean;
  allowFlyerSpeedLeveling: boolean;
}

/** ASB preset "official" (json/serverMultipliers.json). */
export const OFFICIAL_SERVER_MULTIPLIERS: ServerMultipliers = {
  statMultipliers: [
    [0.14, 0.44, 0.2, 1],
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    [0.14, 0.44, 0.17, 1],
    null,
    null,
    null,
  ],
  babyImprintingStatScaleMultiplier: 1,
  babyImprintAmountMultiplier: 1,
  babyCuddleIntervalMultiplier: 1,
  babyMatureSpeedMultiplier: 1,
  eggHatchSpeedMultiplier: 1,
  matingIntervalMultiplier: 1,
  allowSpeedLeveling: false,
  allowFlyerSpeedLeveling: false,
};

/** A stat with all server multipliers applied (ASB SpeciesStat). */
export interface SpeciesStat {
  baseValue: number;
  incPerWildLevel: number;
  incPerMutatedLevel: number;
  incPerTamedLevel: number;
  addWhenTamed: number;
  multAffinity: number;
  /** false when level-ups add a fixed amount instead of a percentage. */
  increaseStatAsPercentage: boolean;
  valueCap: number;
}

export interface PreparedSpecies {
  raw: RawSpecies;
  name: string;
  stats: (SpeciesStat | null)[];
  statImprintMultipliers: number[];
  tamedBaseHealthMultiplier: number | null;
  multipliers: ServerMultipliers;
  /** Maturation time in seconds with the server multiplier applied. */
  maturationTimeAdjusted: number | null;
  usesStat(stat: number): boolean;
  displaysStat(stat: number): boolean;
  canLevelUpWildOrHaveMutations(stat: number): boolean;
}

/** ASE defaults, used by ASB when a species has no statImprintMult. */
const DEFAULT_STAT_IMPRINT_MULT = [0.2, 0, 0.2, 0, 0.2, 0.2, 0, 0.2, 0.2, 0.2, 0, 0];

/** Stats that older game versions allowed wild levels in (ASB json/canHaveWildLevelExceptions.json). */
const WILD_LEVEL_EXCEPTIONS: Record<string, number> = {
  Basilisk: 8,
  Karkinos: 8,
  Maeguana: 8,
  Maewing: 8,
};

/** Port of ASB Species.Initialize() + Values.ApplyMultipliers() + Species.ApplyCanLevelOptions(). */
export function prepareSpecies(
  raw: RawSpecies,
  multipliers: ServerMultipliers = OFFICIAL_SERVER_MULTIPLIERS,
): PreparedSpecies {
  let skipWildLevelStats = raw.skipWildLevelStats & ~(WILD_LEVEL_EXCEPTIONS[raw.name] ?? 0);
  let usedStats = 0;
  const stats: (SpeciesStat | null)[] = [];
  const mutationMult = raw.mutationMult ?? Array<number>(STATS_COUNT).fill(1);
  const useSpeedLevelup = multipliers.allowFlyerSpeedLeveling || !raw.isFlyer;

  for (let s = 0; s < STATS_COUNT; s++) {
    const r = raw.fullStatsRaw[s];
    if (!r) {
      stats.push(null);
      skipWildLevelStats |= 1 << s;
      continue;
    }
    usedStats |= 1 << s;

    const [base = 0, iw = 0, id = 0, ta = 0, tmRaw = 0] = r;
    // The game treats a negative multiplicative taming bonus as 0.
    const tm = Math.max(0, tmRaw);
    const m = multipliers.statMultipliers[s] ?? [1, 1, 1, 1];

    const incPerWildLevel = iw * m[3];
    stats.push({
      baseValue: base,
      incPerWildLevel,
      incPerMutatedLevel: incPerWildLevel * (mutationMult[s] ?? 1),
      incPerTamedLevel: useSpeedLevelup || s !== Stat.Speed ? id * m[2] : 0,
      addWhenTamed: ta * (ta > 0 ? m[0] : 1),
      multAffinity: tm * (tm > 0 ? m[1] : 1),
      increaseStatAsPercentage: raw.statLevelUpsAdditive?.[String(s)] !== true,
      valueCap: raw.statCaps?.[String(s)] ?? Number.POSITIVE_INFINITY,
    });
  }

  let displayedStats = raw.displayedStats ?? usedStats;
  const statImprintMultipliers = [...(raw.statImprintMult ?? DEFAULT_STAT_IMPRINT_MULT)];

  const speedBit = 1 << Stat.Speed;
  const speedCanBeLeveled =
    multipliers.allowSpeedLeveling && (multipliers.allowFlyerSpeedLeveling || !raw.isFlyer);
  if (speedCanBeLeveled) {
    displayedStats |= speedBit;
    skipWildLevelStats &= ~speedBit;
  } else {
    displayedStats &= ~speedBit;
    statImprintMultipliers[Stat.Speed] = 0;
    skipWildLevelStats |= speedBit;
  }

  return {
    raw,
    name: raw.name,
    stats,
    statImprintMultipliers,
    tamedBaseHealthMultiplier: raw.tamedBaseHealthMultiplier ?? null,
    multipliers,
    maturationTimeAdjusted:
      raw.breeding && multipliers.babyMatureSpeedMultiplier > 0
        ? raw.breeding.maturationTime / multipliers.babyMatureSpeedMultiplier
        : null,
    usesStat: (s) => (usedStats & (1 << s)) !== 0,
    displaysStat: (s) => (displayedStats & (1 << s)) !== 0,
    canLevelUpWildOrHaveMutations: (s) => (skipWildLevelStats & (1 << s)) === 0,
  };
}
