import { chosenLevels, extractCreature, type Creature, type ServerSettings } from "@ark-breeding/core";
import type { LevelsUpdate } from "./api";
import { loadSpeciesData } from "./species";

/**
 * EF-05: re-extracts the levels of the library with new server settings. Creatures that no
 * longer extract keep their previous levels and are reported.
 */
export async function recomputeLevels(creatures: Creature[], settings: ServerSettings) {
  const species = await loadSpeciesData();
  const updates: LevelsUpdate[] = [];
  const failed: Creature[] = [];

  for (const c of creatures) {
    const prepared = species.prepared(c.speciesId, settings.multipliers);
    if (!prepared || c.kind === "wild") continue;
    const result = extractCreature({
      species: prepared,
      level: c.level,
      statValues: c.statValues,
      kind: c.kind,
      imprintingBonus: c.imprintingBonus,
      // creatures imported from export files have their in-game id and full precision values
      highPrecisionInputs: c.arkId !== null,
      maxWildLevel: settings.maxWildLevel,
    });
    if (!result.valid) {
      failed.push(c);
      continue;
    }
    updates.push({
      id: c.id,
      ...chosenLevels(result),
      tamingEffectiveness: result.kind === "tamed" && result.tamingEffectiveness >= 0 ? Math.min(1, result.tamingEffectiveness) : null,
      imprintingBonus: result.kind === "bred" ? result.imprintingBonus : 0,
      extractionUnique: result.unique,
    });
  }
  return { updates, failed };
}
