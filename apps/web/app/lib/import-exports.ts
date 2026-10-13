import {
  creatureFromExport,
  extractCreature,
  parseExportFile,
  speciesIdFromBlueprint,
  type CreatureInput,
  type ServerSettings,
} from "@ark-breeding/core";
import { loadSpeciesData } from "./species";

export interface ImportFailure {
  file: string;
  reason: string;
}

export interface ImportResult {
  creatures: CreatureInput[];
  /** Saved, but the player should check the levels (several combinations possible). */
  ambiguous: string[];
  failures: ImportFailure[];
}

/** EF-06: reads export files, extracts the levels in the browser, returns what to save. */
export async function readExportFiles(files: File[], settings: ServerSettings): Promise<ImportResult> {
  const species = await loadSpeciesData();
  const result: ImportResult = { creatures: [], ambiguous: [], failures: [] };

  for (const file of files) {
    const exported = parseExportFile(await file.text());
    if (!exported) {
      result.failures.push({ file: file.name, reason: "Ce n'est pas un fichier d'export de créature." });
      continue;
    }
    const prepared = species.prepared(speciesIdFromBlueprint(exported.blueprintPath), settings.multipliers);
    if (!prepared) {
      result.failures.push({ file: file.name, reason: "Espèce inconnue (créature moddée ?)." });
      continue;
    }

    const extraction = extractCreature({
      species: prepared,
      level: exported.level,
      statValues: exported.statValues,
      kind: exported.isBred ? "bred" : "tamed",
      imprintingBonus: exported.imprintingBonus,
      highPrecisionInputs: true,
      maxWildLevel: settings.maxWildLevel,
    });
    if (!extraction.valid) {
      result.failures.push({
        file: file.name,
        reason: "Niveaux introuvables : vérifie les réglages du serveur dans la page Tribu.",
      });
      continue;
    }

    const creature = creatureFromExport(exported, extraction, species.colors);
    if (!creature.name) creature.name = prepared.name;
    result.creatures.push(creature);
    if (!extraction.unique) result.ambiguous.push(creature.name);
  }
  return result;
}
