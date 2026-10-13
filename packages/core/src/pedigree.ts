// EF-14 / EF-16: family tree. A parent is the creature chosen by hand (motherId / fatherId) or,
// failing that, the one of the library with the in-game id the export file gave.

export interface PedigreeCreature {
  id: string;
  name: string;
  arkId: string | null;
  motherId: string | null;
  fatherId: string | null;
  motherArkId: string | null;
  fatherArkId: string | null;
  motherName: string | null;
  fatherName: string | null;
}

export interface PedigreeNode<C extends PedigreeCreature> {
  /** The creature, when it is in the library. */
  creature: C | null;
  /** Name known from the child's export file even if the parent is not in the library. */
  name: string | null;
  mother: PedigreeNode<C> | null;
  father: PedigreeNode<C> | null;
}

export function createParentResolver<C extends PedigreeCreature>(creatures: readonly C[]) {
  const byId = new Map(creatures.map((c) => [c.id, c]));
  const byArkId = new Map(creatures.filter((c) => c.arkId).map((c) => [c.arkId!, c]));
  return {
    mother: (c: C) => (c.motherId && byId.get(c.motherId)) || (c.motherArkId && byArkId.get(c.motherArkId)) || null,
    father: (c: C) => (c.fatherId && byId.get(c.fatherId)) || (c.fatherArkId && byArkId.get(c.fatherArkId)) || null,
    children: (parent: C) =>
      creatures.filter(
        (c) =>
          c.motherId === parent.id ||
          c.fatherId === parent.id ||
          (!!parent.arkId && (c.motherArkId === parent.arkId || c.fatherArkId === parent.arkId)),
      ),
  };
}

/** Tree of `generations` levels (the creature itself is generation 1). */
export function buildPedigree<C extends PedigreeCreature>(root: C, creatures: readonly C[], generations = 5): PedigreeNode<C> {
  const resolve = createParentResolver(creatures);
  const build = (c: C | null, name: string | null, depth: number, seen: Set<string>): PedigreeNode<C> => {
    // a corrupt cycle (a creature its own ancestor) stops the branch
    const usable = c && !seen.has(c.id) ? c : null;
    const nextSeen = usable ? new Set(seen).add(usable.id) : seen;
    const deeper = depth < generations && usable;
    return {
      creature: usable,
      name: usable?.name ?? name,
      mother: deeper ? build(resolve.mother(usable), usable.motherName, depth + 1, nextSeen) : null,
      father: deeper ? build(resolve.father(usable), usable.fatherName, depth + 1, nextSeen) : null,
    };
  };
  return build(root, root.name, 1, new Set());
}

/** Nodes per generation, left to right (mother before father); missing ancestors are null. */
export function pedigreeGenerations<C extends PedigreeCreature>(root: PedigreeNode<C>, generations = 5) {
  const rows: (PedigreeNode<C> | null)[][] = [[root]];
  for (let g = 1; g < generations; g++)
    rows.push(rows[g - 1]!.flatMap((n) => [n?.mother ?? null, n?.father ?? null]));
  return rows;
}

// EF-16 when the export file has no ancestry (frequent in ASA): find the parents from the
// genetics. Each stat of a baby comes from its mother or its father; its mother-side mutation
// counter is the mother's total plus the mutations rolled on her side (same for the father);
// a new mutation adds 2 levels to one stat.

export interface GeneticCreature {
  id: string;
  sex: "male" | "female" | "unknown";
  kind: "wild" | "tamed" | "bred";
  /** Inheritable points per stat index (wild + mutated); < 0 = unknown. */
  points: number[];
  mutationsMother: number;
  mutationsFather: number;
}

export interface ParentCandidate {
  motherId: string;
  fatherId: string;
  /** Mutations the baby got from this pair (0 = every stat comes straight from a parent). */
  newMutations: number;
}

const LEVELS_PER_MUTATION = 2;
const MAX_NEW_MUTATIONS = 3;

/**
 * Pairs of the same line that can be the parents of `child`, most likely first (fewest new
 * mutations). `line` is the creatures of the same species; `stats` the stats that carry wild
 * levels. Creatures descending from the child are never proposed.
 */
export function findParentCandidates(
  child: GeneticCreature,
  line: readonly GeneticCreature[],
  stats: readonly number[],
  options: { noGender?: boolean; descendants?: ReadonlySet<string> } = {},
): ParentCandidate[] {
  if (child.kind !== "bred") return [];
  const usable = line.filter((c) => c.id !== child.id && !options.descendants?.has(c.id));
  const mothers = usable.filter((c) => options.noGender || c.sex === "female" || c.sex === "unknown");
  const fathers = usable.filter((c) => options.noGender || c.sex === "male" || c.sex === "unknown");
  const total = (c: GeneticCreature) => c.mutationsMother + c.mutationsFather;

  const candidates: ParentCandidate[] = [];
  for (const mother of mothers) {
    const fromMother = child.mutationsMother - total(mother);
    if (fromMother < 0 || fromMother > MAX_NEW_MUTATIONS) continue;
    for (const father of fathers) {
      if (father.id === mother.id) continue;
      const fromFather = child.mutationsFather - total(father);
      const newMutations = fromMother + fromFather;
      if (fromFather < 0 || newMutations > MAX_NEW_MUTATIONS) continue;

      // every stat must come from one parent, a mutated one being 2 levels above per mutation
      let mutationsNeeded = 0;
      let fits = true;
      for (const s of stats) {
        const c = child.points[s] ?? -1;
        const m = mother.points[s] ?? -1;
        const f = father.points[s] ?? -1;
        if (c < 0 || m < 0 || f < 0) continue; // unknown: no evidence either way
        if (c === m || c === f) continue;
        const above = Math.min(...[c - m, c - f].filter((d) => d > 0 && d % LEVELS_PER_MUTATION === 0));
        if (!Number.isFinite(above)) {
          fits = false;
          break;
        }
        mutationsNeeded += above / LEVELS_PER_MUTATION;
      }
      if (fits && mutationsNeeded <= newMutations) candidates.push({ motherId: mother.id, fatherId: father.id, newMutations });
    }
  }
  return candidates.sort((a, b) => a.newMutations - b.newMutations);
}
