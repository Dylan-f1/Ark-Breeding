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
