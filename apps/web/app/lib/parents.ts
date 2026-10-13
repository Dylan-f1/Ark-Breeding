import {
  createParentResolver,
  findParentCandidates,
  type Creature,
  type GeneticCreature,
  type ParentCandidate,
  type PreparedSpecies,
  type ServerSettings,
} from "@ark-breeding/core";
import { breedableStats, wildPoints } from "~/components/library/species-table";
import { fetchLibrary, updateCreature } from "./api";
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

/**
 * Links every bred creature that has no known parents when exactly one pair of the library fits
 * (ASA export files often carry no ancestry). Returns how many were linked.
 */
export async function autoLinkParents(
  creatures: Creature[],
  prepared: (speciesId: string) => PreparedSpecies | undefined,
): Promise<number> {
  const resolve = createParentResolver(creatures);
  let linked = 0;
  for (const c of creatures) {
    if (c.kind !== "bred" || resolve.mother(c) || resolve.father(c)) continue;
    const species = prepared(c.speciesId);
    if (!species) continue;
    const candidates = parentCandidates(c, creatures, species);
    if (candidates.length !== 1) continue;
    await updateCreature(c.id, { motherId: candidates[0]!.motherId, fatherId: candidates[0]!.fatherId });
    linked++;
  }
  return linked;
}

/** Runs autoLinkParents on the whole current library (after an import or a manual entry). */
export async function linkParentsInLibrary(settings: ServerSettings): Promise<number> {
  const [{ creatures }, species] = await Promise.all([fetchLibrary(), loadSpeciesData()]);
  return autoLinkParents(creatures, (id) => species.prepared(id, settings.multipliers));
}
