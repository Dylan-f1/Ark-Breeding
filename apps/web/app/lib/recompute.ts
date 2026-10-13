import { chosenLevels, extractCreature, settingsFingerprint, type Creature, type ServerSettings } from "@ark-breeding/core";
import { fetchLibrary, saveRecomputedLevels, type LevelsUpdate } from "./api";
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

/**
 * Re-extracts the whole current library with these settings and records their fingerprint
 * on the tribe. Used after a settings change and when a followed server was edited (EF-27).
 */
export async function applySettingsToLibrary(settings: ServerSettings) {
  const { creatures } = await fetchLibrary();
  const { updates, failed } = await recomputeLevels(creatures, settings);
  await saveRecomputedLevels(updates, settingsFingerprint(settings));
  return { total: creatures.length, updated: updates.length, failed };
}

export function recomputeSummary({ total, updated, failed }: Awaited<ReturnType<typeof applySettingsToLibrary>>) {
  if (!total) return undefined;
  const names = failed.slice(0, 5).map((c) => c.name).join(", ");
  return `Niveaux recalculés pour ${updated} créature(s).${
    failed.length
      ? ` ${failed.length} n'ont pas pu l'être (valeurs incompatibles avec ces réglages) : ${names}${failed.length > 5 ? "…" : "."}`
      : ""
  }`;
}
