// ASA species data from ARK Smart Breeding (MIT, see ../data/ASB-LICENSE.txt).
// Separate entry point (`@ark-breeding/core/species-data`) so the 500 kB JSON never ends up in
// bundles that only need the calculations.
import data from "../data/species-asa.json";
import type { RawSpecies } from "./species";

export const ASA_SPECIES: readonly RawSpecies[] = data.species as RawSpecies[];

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
