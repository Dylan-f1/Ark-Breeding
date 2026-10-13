// EF-12 / EF-13: best pairs of a line. Inheritance rules as in ASB (Ark.cs): each stat comes
// from one parent, the higher level with 55 % probability; up to 3 mutation rolls of 2.5 %, a
// roll only mutates if the parent it picks has fewer than 20 mutations.

export const PROBABILITY_INHERIT_HIGHER = 0.55;
export const MUTATION_LIMIT = 20;
const PROBABILITY_OF_MUTATION = 0.025;
const MUTATION_ROLLS = 3;

export interface BreedingCandidate {
  id: string;
  name: string;
  sex: "male" | "female" | "unknown";
  /** Inheritable points per stat index (wild + mutated levels); < 0 = unknown. */
  points: number[];
  mutationsMother: number;
  mutationsFather: number;
}

export interface BreedingPair {
  motherId: string;
  fatherId: string;
  /**
   * 0..1, the ranking key (EF-12): half the share of the line's best stats the pair combines
   * (how a line progresses), half the mean of (best points of the pair / best of the line).
   */
  score: number;
  /** Best points the pair can pass on, per stat index (only selected stats are meaningful). */
  bestPoints: number[];
  /** Selected stats where the pair can pass on the best value of the whole line. */
  topStats: number[];
  /** Probability of a baby with the pair's best value in every selected stat (EF-13). */
  perfectChance: number;
  /** Probability of at least one mutation. */
  mutationChance: number;
}

export interface BreedingPlan {
  /** Best points of the line per stat index. */
  linePoints: number[];
  pairs: BreedingPair[];
  /** Number of creatures that could take part (available, not neutered). */
  candidateCount: number;
}

const totalMutations = (c: BreedingCandidate) => c.mutationsMother + c.mutationsFather;

/** Probability that at least one of the 3 rolls mutates (ASB Ark.ProbabilityOfOneMutation*). */
export function mutationChance(mother: BreedingCandidate, father: BreedingCandidate): number {
  const open = [mother, father].filter((p) => totalMutations(p) < MUTATION_LIMIT).length;
  if (open === 0) return 0;
  const perRoll = open === 2 ? PROBABILITY_OF_MUTATION : PROBABILITY_OF_MUTATION / 2;
  return 1 - (1 - perRoll) ** MUTATION_ROLLS;
}

/**
 * Ranks every mother × father pair on the selected stats by score.
 * Species without gender (noGender) pair any two creatures.
 */
export function planBreeding(
  candidates: BreedingCandidate[],
  stats: number[],
  options: { limit?: number; noGender?: boolean } = {},
): BreedingPlan {
  const limit = options.limit ?? 5;
  const points = (c: BreedingCandidate, s: number) => Math.max(0, c.points[s] ?? 0);
  const linePoints: number[] = [];
  for (const s of stats) linePoints[s] = Math.max(0, ...candidates.map((c) => points(c, s)));

  const pairsToRank: [BreedingCandidate, BreedingCandidate][] = [];
  if (options.noGender) {
    for (let i = 0; i < candidates.length; i++)
      for (let j = i + 1; j < candidates.length; j++) pairsToRank.push([candidates[i]!, candidates[j]!]);
  } else {
    const mothers = candidates.filter((c) => c.sex === "female");
    const fathers = candidates.filter((c) => c.sex === "male");
    for (const m of mothers) for (const f of fathers) pairsToRank.push([m, f]);
  }

  const pairs = pairsToRank.map(([mother, father]): BreedingPair => {
    const bestPoints: number[] = [];
    const topStats: number[] = [];
    let ratioSum = 0;
    let perfectChance = 1;
    for (const s of stats) {
      const a = points(mother, s);
      const b = points(father, s);
      const best = Math.max(a, b);
      bestPoints[s] = best;
      const top = linePoints[s] ?? 0;
      ratioSum += top > 0 ? best / top : 1;
      if (best === top) topStats.push(s);
      if (a !== b) perfectChance *= PROBABILITY_INHERIT_HIGHER;
    }
    return {
      motherId: mother.id,
      fatherId: father.id,
      score: stats.length ? (topStats.length / stats.length + ratioSum / stats.length) / 2 : 0,
      bestPoints,
      topStats,
      perfectChance,
      mutationChance: mutationChance(mother, father),
    };
  });

  const sumPoints = (p: BreedingPair) => stats.reduce((acc, s) => acc + (p.bestPoints[s] ?? 0), 0);
  pairs.sort((x, y) => y.score - x.score || y.perfectChance - x.perfectChance || sumPoints(y) - sumPoints(x));
  return { linePoints, pairs: pairs.slice(0, limit), candidateCount: candidates.length };
}
