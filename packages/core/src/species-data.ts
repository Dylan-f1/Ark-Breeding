// ASA species data from ARK Smart Breeding (MIT, see ../data/ASB-LICENSE.txt).
// Separate entry point (`@ark-breeding/core/species-data`) so the 500 kB JSON never ends up in
// bundles that only need the calculations.
import data from "../data/species-asa.json";
import type { ArkColor } from "./colors";
import { speciesIdFromBlueprint } from "./creature";
import type { RawSpecies } from "./species";

export const ASA_SPECIES: readonly RawSpecies[] = data.species as RawSpecies[];

/** Colours with their ASA ids (base colours 1-100, dyes 128-254). */
export const ASA_COLORS: readonly ArkColor[] = data.colors as ArkColor[];

export const ASA_DATA_VERSION = {
  source: data.source,
  asaValuesVersion: data.asaValuesVersion,
  baseValuesVersion: data.baseValuesVersion,
};

const byBlueprint = new Map(ASA_SPECIES.map((s) => [s.blueprintPath, s]));

/** Export files reference the blueprint, sometimes with a trailing "_C". */
export function findSpeciesByBlueprint(blueprintPath: string): RawSpecies | undefined {
  const path = blueprintPath.endsWith("_C") ? blueprintPath.slice(0, -2) : blueprintPath;
  return byBlueprint.get(path);
}

const byId = new Map(ASA_SPECIES.map((s) => [speciesIdFromBlueprint(s.blueprintPath), s]));

export function findSpeciesById(id: string): RawSpecies | undefined {
  return byId.get(id);
}
