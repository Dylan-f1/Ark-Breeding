// D-40. Corrections to the ASB species data after the game changed (ASB ships the values, the game
// is the truth). Each one recognises the OLD values and rewrites them, so it switches itself off
// the day ASB ships the fix: nothing to remove by hand, and a test says when it did nothing.
//
// Not listed here on purpose: anything that has not been measured on exports of the game.

import type { RawSpecies, RawStat } from "./species";
import { Stat } from "./stats";

/** Position of the added / multiplied taming bonus in a raw stat [base, wild, dom, Ta, Tm]. */
const ADD_WHEN_TAMED = 3;
const MULT_AFFINITY = 4;

/**
 * Food, since the game update of November 2026 (patch 97): the taming bonus of the food stat is no
 * longer a share of the value that grows with the taming effectiveness, it is a flat +0.15.
 * ASB still has `Tm = 0.15` (so 209 species are affected, those whose food bonus is 0.15; the
 * others have none and were never wrong).
 *
 * Measured on three independent sources, all exact once the rule is applied:
 *  - a Thylacoleo tamed in the wild: food level 38 read with the Tek binoculars gives 7200.15;
 *  - a Dire Wolf tamed in the wild: food level 31 gives 4920.15, and the six levels (30, 52, 39, 31,
 *    28, 28) are the ones read with the Tek binoculars;
 *  - the bred Pteranodon of ASB issue #1422: level 4 at 91.67 % imprinting gives 1988.15 (1988.2 shown),
 *    while no level gives it with the old rule.
 * The other TE bonuses (melee 0.35, etc.) still follow the old rule: the same exports match.
 */
function correctFood(stats: (RawStat | null)[]): (RawStat | null)[] {
  const food = stats[Stat.Food];
  if (!food || food[ADD_WHEN_TAMED] !== 0 || food[MULT_AFFINITY] !== 0.15) return stats;
  const corrected = [...stats];
  corrected[Stat.Food] = [food[0]!, food[1]!, food[2]!, 0.15, 0];
  return corrected;
}

/** The species as the game computes it today. Returns the same object when nothing changes. */
export function correctSpecies(raw: RawSpecies): RawSpecies {
  const fullStatsRaw = correctFood(raw.fullStatsRaw);
  return fullStatsRaw === raw.fullStatsRaw ? raw : { ...raw, fullStatsRaw };
}
