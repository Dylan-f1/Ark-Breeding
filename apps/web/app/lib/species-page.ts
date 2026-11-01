// EF-18: what a public species page shows, computed at build time from the ASB values with the
// official rates (ENF-05: pre-rendered, the 500 kB data never reaches the browser).

import {
  STAT_DISPLAY_ORDER,
  STAT_NAMES_FR,
  Stat,
  calculateStatValue,
  isPercentageStat,
  prepareSpecies,
  type CatalogEntry,
} from "@ark-breeding/core";

/** Where a creature comes from, from its ASB tags. */
const ORIGINS: Record<string, string> = {
  Aberration: "Aberration",
  Astraeos: "Astraeos",
  Extinction: "Extinction",
  Genesis: "Genesis : partie 1",
  LostColony: "Lost Colony",
  Ragnarok: "Ragnarok",
  ScorchedEarth: "Scorched Earth",
  Valguero: "Valguero",
  Companion: "Créature premium",
  Steampunk: "Créature premium",
  Wasteland: "Créature premium",
};

export interface SpeciesStatRow {
  stat: number;
  name: string;
  percent: boolean;
  /** Wild creature, level 1. */
  base: number;
  perWildLevel: number;
  /** After taming (100 % effectiveness), per level the player gives. */
  perDomLevel: number;
}

export interface SpeciesPageData {
  id: string;
  label: string;
  slug: string;
  origin: string | null;
  flyer: boolean;
  noGender: boolean;
  stats: SpeciesStatRow[];
  breeding: {
    /** Egg incubation, or gestation for live births, in seconds. */
    birth: { kind: "egg" | "gestation"; seconds: number };
    maturation: number;
    matingCooldown: [number, number];
    eggTemperature: [number, number] | null;
  } | null;
  colorRegions: { index: number; name: string }[];
}

export function speciesPageData(entry: CatalogEntry): SpeciesPageData {
  const species = prepareSpecies(entry.raw);
  const value = (s: number, wild: number, dom: number, tamed: boolean) =>
    calculateStatValue(species, s, { wild, dom }, { tamed, tamingEffectiveness: 1, round: false });
  const stats = STAT_DISPLAY_ORDER.filter((s) => species.usesStat(s) && (species.displaysStat(s) || s === Stat.Torpidity)).map(
    (s) => ({
      stat: s,
      name: STAT_NAMES_FR[s]!,
      percent: isPercentageStat(s),
      base: value(s, 0, 0, false),
      perWildLevel: value(s, 1, 0, false) - value(s, 0, 0, false),
      perDomLevel: s === Stat.Torpidity ? 0 : value(s, 0, 1, true) - value(s, 0, 0, true),
    }),
  );
  const b = entry.raw.breeding;
  return {
    id: entry.id,
    label: entry.label,
    slug: entry.slug,
    origin: entry.raw.variants?.map((v) => ORIGINS[v]).find(Boolean) ?? null,
    flyer: !!entry.raw.isFlyer,
    noGender: !!entry.raw.noGender,
    stats,
    breeding:
      b && b.maturationTime > 0
        ? {
            birth: b.gestationTime > 0 ? { kind: "gestation", seconds: b.gestationTime } : { kind: "egg", seconds: b.incubationTime },
            maturation: b.maturationTime,
            matingCooldown: [b.matingCooldownMin, b.matingCooldownMax],
            eggTemperature: b.gestationTime > 0 || b.eggTempMin === undefined ? null : [b.eggTempMin, b.eggTempMax ?? b.eggTempMin],
          }
        : null,
    colorRegions: (entry.raw.colorRegions ?? []).flatMap((name, index) => (name ? [{ index, name }] : [])),
  };
}

/** "2 j 5 h 36 min", "45 min", "30 s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  // rounded to the minute first: 4 h 59 min 50 s is "5 h", not "4 h 60 min"
  const minutes = Math.round(seconds / 60);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d} j`, h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ") || "0 min";
}

export const formatStat = (v: number, percent: boolean) =>
  percent
    ? `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`
    : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
