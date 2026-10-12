import { roundAwayFromZero, roundToEven } from "./math";
import type { PreparedSpecies } from "./species";
import { Stat, statPrecision } from "./stats";

export interface StatLevels {
  wild: number;
  mutated?: number;
  dom?: number;
}

export interface StatValueOptions {
  tamed: boolean;
  /** Taming effectiveness, 0..1 (1 for bred creatures). */
  tamingEffectiveness?: number;
  /** Imprinting bonus, 0..1. */
  imprintingBonus?: number;
  /** Round like the game displays the value (default true). */
  round?: boolean;
}

/** Port of ASB StatValueCalculation.CalculateValue(). Percentage stats are returned as factors. */
export function calculateStatValue(
  species: PreparedSpecies,
  stat: number,
  levels: StatLevels,
  { tamed, tamingEffectiveness = 0, imprintingBonus = 0, round = true }: StatValueOptions,
): number {
  const s = species.stats[stat];
  if (!s) return 0;
  // unknown wild level for a stat that can have them
  if (levels.wild < 0 && s.incPerWildLevel !== 0) return -1;

  let add = 0;
  let domMult = 1;
  let imprintingM = 1;
  let tamedBaseHP = 1;
  let levelDom = levels.dom ?? 0;

  if (tamed) {
    add = s.addWhenTamed;
    // the multiplicative bonus only scales with TE when positive
    let domMultAffinity = s.multAffinity;
    if (domMultAffinity >= 0) domMultAffinity *= tamingEffectiveness;
    domMult = tamingEffectiveness >= 0 ? 1 + domMultAffinity : 1;
    const statImprintMult = species.statImprintMultipliers[stat] ?? 0;
    if (imprintingBonus > 0 && statImprintMult !== 0) {
      imprintingM =
        1 + statImprintMult * imprintingBonus * species.multipliers.babyImprintingStatScaleMultiplier;
    }
    if (stat === Stat.Health) tamedBaseHP = species.tamedBaseHealthMultiplier ?? 1;
  } else {
    levelDom = 0;
  }

  const wildLevelIncrease = levels.wild * s.incPerWildLevel + (levels.mutated ?? 0) * s.incPerMutatedLevel;
  const domLevelIncrease = levelDom * s.incPerTamedLevel;

  let result = s.increaseStatAsPercentage
    ? (s.baseValue * (1 + wildLevelIncrease) * tamedBaseHP * imprintingM + add) * domMult * (1 + domLevelIncrease)
    : ((s.baseValue + wildLevelIncrease) * tamedBaseHP * imprintingM + add) * domMult + domLevelIncrease;

  if (result <= 0) return 0;
  result = Math.min(result, s.valueCap);
  return round ? roundAwayFromZero(result, statPrecision(stat)) : result;
}

/** Wild level a tamed creature had before taming (ASB Creature.CalculatePreTameWildLevel). */
export function preTameWildLevel(postTameLevel: number, tamingEffectiveness: number): number {
  return Math.ceil(roundToEven(postTameLevel / (1 + tamingEffectiveness / 2), 6));
}
