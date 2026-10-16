// Which species of the ASB data a player can own, and how they are named: shared by the library
// (D-21, D-23) and the public species pages (EF-18), built at compile time.

import { speciesIdFromBlueprint } from "./creature";
import type { RawSpecies } from "./species";

/**
 * ASB tags a creature with the map or DLC it comes from as if it were a variant ("ScorchedEarth"
 * for the wyverns): with only such tags, it is a species of its own, not a variant. Only the maps
 * already out on ASA (14/10/2026): Genesis 2, Crystal Isles, Fjordur, Lost Island are not (D-23).
 * "Ocean" goes with Genesis (X- creatures). The premium creatures (Fantastic Tames…) carry pack
 * tags: "Companion" (Drakelings, Veilwyn), "Steampunk" (Cosmo), "Wasteland" (Armadoggo).
 */
const MAP_TAGS = new Set([
  "Aberration", "Astraeos", "Extinction", "Genesis", "LostColony", "Ocean", "Ragnarok", "ScorchedEarth", "Valguero",
  "Companion", "Steampunk", "Wasteland",
]);

/**
 * Left out of the catalog: creatures a player cannot tame (event decorations, bosses, taming
 * stages) and the Tek Giganotosaurus, which is a plain Giganotosaurus in game (D-23).
 */
const NOT_OWNABLE = new Set([
  "BionicGigant_Character_BP", // Tek Giganotosaurus
  "BossBat_Character_BP", // Gigadesmodus (boss)
  "BunnyOviraptor_Character_BP",
  "ChupaCabra_Character_BP", // Nameless
  "ChupaCabra_Character_BP_Surface",
  "Direbear_Character_Polar", // Polar Bear
  "Dodo_Character_BP_Birthday", // Party Dodo
  "Dodo_Character_BP_Bunny",
  "LighBacon_Character_BP_LuminaTaming", // Argentavis being turned into a Lumina
  "Maelizard_Character_BP", // Maeguana
  "Purlovia_Character_BP_Polar",
  "SpiderS_Character_BP_Juvenile", // Araneo, young
  "Yeti_Character_BP",
]);

/** A species of its own (not a mission, boss or aberrant variant). */
export const isOwnSpecies = (raw: RawSpecies) => (raw.variants ?? []).every((v) => MAP_TAGS.has(v));

/** "Dodo (Bog, Gauntlet…)" for variants; map and pack tags are left out. */
export function speciesLabel(raw: RawSpecies): string {
  const extra = raw.variants?.filter((v) => !raw.name.includes(v) && !MAP_TAGS.has(v)) ?? [];
  return extra.length ? `${raw.name} (${extra.join(", ")})` : raw.name;
}

/** Address of the public page: "Tidepup (Large)" → "tidepup-large". */
export function speciesSlug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface CatalogEntry {
  id: string;
  label: string;
  slug: string;
  raw: RawSpecies;
}

/** Species a player can own, one per name, sorted by name (D-21, D-23). */
export function buildCatalog(all: readonly RawSpecies[]): CatalogEntry[] {
  const byName = new Map<string, RawSpecies>();
  for (const raw of all) {
    if (!isOwnSpecies(raw) || !raw.breeding || NOT_OWNABLE.has(speciesIdFromBlueprint(raw.blueprintPath))) continue;
    const label = speciesLabel(raw);
    const kept = byName.get(label);
    // the base blueprint has the shortest path (not _Juvenile, _Override…)
    if (!kept || raw.blueprintPath.length < kept.blueprintPath.length) byName.set(label, raw);
  }
  return [...byName.entries()]
    .map(([label, raw]) => ({ id: speciesIdFromBlueprint(raw.blueprintPath), label, slug: speciesSlug(label), raw }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
