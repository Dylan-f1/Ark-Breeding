// Helpers for the round-trip extraction tests.

import { extractCreature, type CreatureKind } from "./extract-creature";
import { imprintingGainPerCuddle } from "./extraction";
import type { PreparedSpecies } from "./species";
import { calculateStatValue } from "./stat-value";
import { STATS_COUNT, Stat } from "./stats";

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TestCreature {
  kind: CreatureKind;
  level: number;
  wild: number[];
  dom: number[];
  te: number;
  /** Exact imprinting of the creature. */
  imprinting: number;
  /** Imprinting as the game shows it (whole percent). */
  imprintingShown: number;
  values: number[];
}

export function makeCreature(sp: PreparedSpecies, kind: CreatureKind, rand: () => number, highPrecision: boolean): TestCreature {
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const wildStats: number[] = [];
  const domStats: number[] = [];
  for (let s = 0; s < STATS_COUNT; s++) {
    const st = sp.stats[s];
    if (!st || s === Stat.Torpidity) continue;
    if (sp.canLevelUpWildOrHaveMutations(s) && st.incPerWildLevel > 0) wildStats.push(s);
    if (sp.displaysStat(s) && st.incPerTamedLevel > 0) domStats.push(s);
  }

  let te = 0;
  let imprinting = 0;
  let totalWild: number;
  const preTameLevel = int(1, 150);
  if (kind === "wild") totalWild = preTameLevel - 1;
  else if (kind === "tamed") {
    te = 0.5 + rand() * 0.5;
    totalWild = Math.floor(preTameLevel * (1 + te / 2)) - 1;
  } else {
    te = 1;
    totalWild = int(0, 300);
    // imprinting grows by whole cuddles in game
    const gain = imprintingGainPerCuddle(sp);
    imprinting = Math.min(1, int(0, Math.ceil(1 / gain)) * gain);
  }

  const wild = Array<number>(STATS_COUNT).fill(0);
  for (let i = 0; i < totalWild && wildStats.length; i++) wild[wildStats[int(0, wildStats.length - 1)]!]!++;
  wild[Stat.Torpidity] = totalWild;

  const dom = Array<number>(STATS_COUNT).fill(0);
  if (kind !== "wild") for (const s of domStats) if (rand() < 0.4) dom[s] = int(1, 40);

  const values = Array.from({ length: STATS_COUNT }, (_, s) => {
    const v = calculateStatValue(
      sp,
      s,
      { wild: wild[s]!, dom: dom[s] },
      { tamed: kind !== "wild", tamingEffectiveness: te, imprintingBonus: imprinting, round: !highPrecision },
    );
    return highPrecision ? Math.fround(v) : v;
  });

  return { kind, imprintingShown: Math.round(imprinting * 100) / 100, level: 1 + totalWild + dom.reduce((a, b) => a + b, 0), wild, dom, te, imprinting, values };
}

export function check(sp: PreparedSpecies, c: TestCreature, highPrecision: boolean): string | null {
  const r = extractCreature({
    species: sp,
    level: c.level,
    statValues: c.values,
    kind: c.kind,
    // export files carry the exact imprinting, the game shows it rounded
    imprintingBonus: highPrecision ? c.imprinting : c.imprintingShown,
    highPrecisionInputs: highPrecision,
  });
  if (!r.valid) return `invalid (${r.issues.join(", ")})`;
  for (let s = 0; s < STATS_COUNT; s++) {
    const st = sp.stats[s];
    if (!st) continue;
    // a stat without wild level increase is reported as 0 or -1 (unknown) depending on the branch
    // a value of 0 means "unknown" for the extractor (e.g. tamed health below 0, crafting speed base 0)
    if (c.values[s]! <= 0) {
      if (!r.results[s]!.some((x) => x.levelWild === -1)) return `stat ${s}: value 0 should give an unknown level`;
      continue;
    }
    const wildMatches = (w: number) => (st.incPerWildLevel === 0 ? w <= 0 : w === c.wild[s]);
    const found = r.results[s]!.some((x) => wildMatches(x.levelWild) && x.levelDom === c.dom[s]);
    if (!found)
      return `stat ${s}: expected w${c.wild[s]} d${c.dom[s]}, got ${r.results[s]!.map((x) => `w${x.levelWild} d${x.levelDom}`).join(" | ")}`;
  }
  return null;
}
