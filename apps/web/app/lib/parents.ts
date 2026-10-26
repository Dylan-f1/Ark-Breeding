import {
  LEVELS_PER_MUTATION,
  STAT_NAMES_FR,
  bestParentCandidate,
  createParentResolver,
  explainChild,
  findParentCandidates,
  type Creature,
  type GeneticCreature,
  type ParentCandidate,
  type PreparedSpecies,
  type ServerSettings,
  type StatMutation,
} from "@ark-breeding/core";
import { breedableStats, wildPoints } from "~/components/library/species-table";
import { fetchLibrary, updateCreature, type LevelsUpdate } from "./api";
import { loadSpeciesData } from "./species";

function toGenetic(c: Creature): GeneticCreature {
  return {
    id: c.id,
    sex: c.sex,
    kind: c.kind,
    points: c.levelsWild.map((w, s) => (w < 0 ? -1 : wildPoints(c, s))),
    mutationsMother: c.mutationsMother,
    mutationsFather: c.mutationsFather,
  };
}

/** Creatures descending from `root` (children, grandchildren…): never its parents. */
function descendantsOf(root: Creature, creatures: Creature[]): Set<string> {
  const resolve = createParentResolver(creatures);
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length) {
    for (const child of resolve.children(stack.pop()!)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      stack.push(child);
    }
  }
  return seen;
}

/** EF-16: possible parents of a bred creature, found from the genetics. */
export function parentCandidates(child: Creature, creatures: Creature[], species: PreparedSpecies): ParentCandidate[] {
  const line = creatures.filter((c) => c.speciesId === child.speciesId);
  return findParentCandidates(toGenetic(child), line.map(toGenetic), breedableStats(species), {
    noGender: species.raw.noGender,
    descendants: descendantsOf(child, creatures),
  });
}

export interface MutationInfo {
  /** Mutations this creature got itself, read from its parents' stats. */
  mutations: StatMutation[];
  /** Mutation counters (EF-15): the parents' totals plus its own mutations of that side. */
  mother: number;
  father: number;
  /** The counters come from the parents: the export file had lower ones (ASA leaves them at 0). */
  deduced: boolean;
  /** Mutations carried by each stat, stacked over the generations (index = stat). */
  stacks: number[];
  /** Stats whose stack is a guess: both parents had that value, with different stacks. */
  unsure: number[];
}

/** Mutations a creature without known parents carries on a stat, from its export (0 in most ASA files). */
const exportedStack = (c: Creature, s: number) => Math.floor(Math.max(0, c.levelsMutated[s] ?? 0) / LEVELS_PER_MUTATION);

/**
 * Mutations and counters of every creature of a library. ASA export files leave the counters at 0
 * even after a mutation: they are rebuilt from the known parents, up the whole line.
 */
export function libraryMutations(
  creatures: Creature[],
  prepared: (speciesId: string) => PreparedSpecies | undefined,
): Map<string, MutationInfo> {
  const resolve = createParentResolver(creatures);
  const result = new Map<string, MutationInfo>();
  const visiting = new Set<string>();

  function info(c: Creature): MutationInfo {
    const known = result.get(c.id);
    if (known) return known;
    const own: MutationInfo = {
      mutations: [],
      mother: c.mutationsMother,
      father: c.mutationsFather,
      deduced: false,
      stacks: c.levelsMutated.map((_, s) => exportedStack(c, s)),
      unsure: [],
    };
    const mother = resolve.mother(c);
    const father = resolve.father(c);
    const species = prepared(c.speciesId);
    if (c.kind === "bred" && mother && father && species && !visiting.has(c.id)) {
      visiting.add(c.id);
      own.mutations = explainChild(toGenetic(c), toGenetic(mother), toGenetic(father), breedableStats(species)) ?? [];
      const fromSide = (side: StatMutation["side"]) =>
        own.mutations.filter((m) => m.side === side).reduce((n, m) => n + m.levels / LEVELS_PER_MUTATION, 0);
      const total = (p: Creature) => info(p).mother + info(p).father;
      const expectedMother = total(mother) + fromSide("mother");
      const expectedFather = total(father) + fromSide("father");
      // each stat keeps the stack of the parent it came from, plus its own new mutations
      const [child, mom, dad] = [c, mother, father].map(toGenetic);
      const parentStacks = { mother: info(mother).stacks, father: info(father).stacks };
      for (const stat of breedableStats(species)) {
        const [pc, pm, pf] = [child.points[stat], mom.points[stat], dad.points[stat]];
        if (pc < 0) continue;
        const mutation = own.mutations.find((m) => m.stat === stat);
        const sm = parentStacks.mother[stat] ?? 0;
        const sf = parentStacks.father[stat] ?? 0;
        let stack = 0;
        if (mutation) stack = parentStacks[mutation.side][stat] + mutation.levels / LEVELS_PER_MUTATION;
        else if (pc === pm && pc === pf) {
          stack = Math.max(sm, sf);
          if (sm !== sf) own.unsure.push(stat);
        } else if (pc === pm) stack = sm;
        else if (pc === pf) stack = sf;
        own.stacks[stat] = Math.max(own.stacks[stat] ?? 0, stack);
      }
      visiting.delete(c.id);
      if (expectedMother > own.mother || expectedFather > own.father) {
        own.mother = Math.max(own.mother, expectedMother);
        own.father = Math.max(own.father, expectedFather);
        own.deduced = true;
      }
    }
    result.set(c.id, own);
    return own;
  }

  for (const c of creatures) info(c);
  return result;
}

/** One creature's MutationInfo (the creature page). */
export const creatureMutations = (child: Creature, creatures: Creature[], species: (id: string) => PreparedSpecies | undefined) =>
  libraryMutations(creatures, species).get(child.id)!;

export const describeMutation = (m: StatMutation) =>
  `+${m.levels} ${STAT_NAMES_FR[m.stat]} (côté ${m.side === "mother" ? "mère" : "père"})`;

/**
 * Links the pair to the child; when the export left the mutation counters lower than the
 * genetics show (ASA), they are corrected so the 20-mutation limit (EF-15) stays right.
 */
export function linkParents(child: Creature, candidate: ParentCandidate) {
  const { mutationsMother, mutationsFather } = candidate.expectedCounters;
  const fixCounters = child.mutationsMother < mutationsMother || child.mutationsFather < mutationsFather;
  return updateCreature(child.id, {
    motherId: candidate.motherId,
    fatherId: candidate.fatherId,
    ...(fixCounters && {
      mutationsMother: Math.max(child.mutationsMother, mutationsMother),
      mutationsFather: Math.max(child.mutationsFather, mutationsFather),
    }),
  });
}

export interface AutoLinkResult {
  linked: number;
  /** Mutations found on the creatures that were just linked. */
  mutations: { name: string; mutations: StatMutation[] }[];
}

/**
 * Links every bred creature that has no known parents when one pair of the library clearly fits
 * (ASA export files often carry no ancestry).
 */
export async function autoLinkParents(
  creatures: Creature[],
  prepared: (speciesId: string) => PreparedSpecies | undefined,
): Promise<AutoLinkResult> {
  const resolve = createParentResolver(creatures);
  const result: AutoLinkResult = { linked: 0, mutations: [] };
  for (const c of creatures) {
    if (c.kind !== "bred" || resolve.mother(c) || resolve.father(c)) continue;
    const species = prepared(c.speciesId);
    if (!species) continue;
    const best = bestParentCandidate(parentCandidates(c, creatures, species));
    if (!best) continue;
    await linkParents(c, best);
    result.linked++;
    if (best.mutations.length) result.mutations.push({ name: c.name, mutations: best.mutations });
  }
  return result;
}

/** Runs autoLinkParents on the whole current library (after an import or a manual entry). */
export async function linkParentsInLibrary(settings: ServerSettings): Promise<AutoLinkResult> {
  const [{ creatures }, species] = await Promise.all([fetchLibrary(), loadSpeciesData()]);
  return autoLinkParents(creatures, (id) => species.prepared(id, settings.multipliers));
}

/** One line for a notification: "Mutation : Daeodon 5 (+2 Poids (côté mère))". */
export function mutationSummary(result: AutoLinkResult): string | undefined {
  if (!result.mutations.length) return undefined;
  return `Mutation : ${result.mutations.map((m) => `${m.name} (${m.mutations.map(describeMutation).join(", ")})`).join(" · ")}.`;
}

/**
 * D-26: what to save on each creature so its mutations outlive its parents (deleted when dead or
 * no longer useful): the mutated levels of each stat (2 per mutation, moved out of the wild ones)
 * and the counters found from the parents. Guessed stacks (both parents alike) are not saved.
 */
export function mutationsToSave(creatures: Creature[], infos: ReadonlyMap<string, MutationInfo>): LevelsUpdate[] {
  const updates: LevelsUpdate[] = [];
  for (const c of creatures) {
    const info = infos.get(c.id);
    if (!info) continue;
    const levelsWild = [...c.levelsWild];
    const levelsMutated = [...c.levelsMutated];
    let changed = false;
    info.stacks.forEach((stack, s) => {
      const target = stack * LEVELS_PER_MUTATION;
      const mutated = Math.max(0, levelsMutated[s] ?? 0);
      const points = (levelsWild[s] ?? -1) < 0 ? -1 : levelsWild[s]! + mutated;
      if (info.unsure.includes(s) || target <= mutated || points < target) return;
      levelsWild[s] = points - target;
      levelsMutated[s] = target;
      changed = true;
    });
    const counters = info.mother > c.mutationsMother || info.father > c.mutationsFather;
    if (!changed && !counters) continue;
    updates.push({
      id: c.id,
      levelsWild,
      levelsMutated,
      levelsDom: c.levelsDom,
      tamingEffectiveness: c.tamingEffectiveness,
      imprintingBonus: c.imprintingBonus,
      extractionUnique: c.extractionUnique,
      ...(counters && { mutationsMother: info.mother, mutationsFather: info.father }),
    });
  }
  return updates;
}
