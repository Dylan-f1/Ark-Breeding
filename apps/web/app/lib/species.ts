import {
  prepareSpecies,
  speciesIdFromBlueprint,
  type ArkColor,
  type PreparedSpecies,
  type RawSpecies,
  type ServerMultipliers,
} from "@ark-breeding/core";
import { useEffect, useState } from "react";

type SpeciesDataModule = typeof import("@ark-breeding/core/species-data");

export interface SpeciesOption {
  id: string;
  label: string;
  /** Searchable text: name + variants. */
  keywords: string;
  isMainVariant: boolean;
  raw: RawSpecies;
}

export interface SpeciesData {
  options: SpeciesOption[];
  /** Species a player can own, one per name, sorted: the library lists them all (D-21, D-23). */
  catalog: { id: string; label: string }[];
  colors: readonly ArkColor[];
  byId(id: string): SpeciesOption | undefined;
  /** Species with the tribe's server multipliers applied (EF-05), cached per settings. */
  prepared(id: string, multipliers: ServerMultipliers): PreparedSpecies | undefined;
}

/**
 * ASB tags a creature with the map or DLC it comes from as if it were a variant ("ScorchedEarth"
 * for the wyverns): with only such tags, it is a species of its own, not a variant. Only the maps
 * already out on ASA (14/10/2026): Genesis 2, Crystal Isles, Fjordur, Lost Island are not (D-23).
 * "Ocean" goes with Genesis (X- creatures), "Steampunk" is the Cosmo.
 */
const MAP_TAGS = new Set([
  "Aberration", "Astraeos", "Extinction", "Genesis", "LostColony", "Ocean", "Ragnarok", "ScorchedEarth", "Steampunk",
  "Valguero",
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

const isOwnSpecies = (raw: RawSpecies) => (raw.variants ?? []).every((v) => MAP_TAGS.has(v));

export function speciesLabel(raw: RawSpecies): string {
  const extra = raw.variants?.filter((v) => !raw.name.includes(v) && !MAP_TAGS.has(v)) ?? [];
  return extra.length ? `${raw.name} (${extra.join(", ")})` : raw.name;
}

let loading: Promise<SpeciesData> | null = null;

/** The ~500 kB species file is loaded on demand, in its own chunk. */
export function loadSpeciesData(): Promise<SpeciesData> {
  loading ??= import("@ark-breeding/core/species-data").then((m: SpeciesDataModule) => {
    const options = m.ASA_SPECIES.map((raw) => ({
      id: speciesIdFromBlueprint(raw.blueprintPath),
      label: speciesLabel(raw),
      keywords: [raw.name, ...(raw.variants ?? [])].join(" "),
      isMainVariant: isOwnSpecies(raw),
      raw,
    })).sort((a, b) => Number(b.isMainVariant) - Number(a.isMainVariant) || a.label.localeCompare(b.label, "fr"));
    const byId = new Map(options.map((o) => [o.id, o]));
    // one entry per name: the base blueprint has the shortest path (not _Juvenile, _Override…)
    const byName = new Map<string, SpeciesOption>();
    for (const o of options) {
      if (!o.isMainVariant || !o.raw.breeding || NOT_OWNABLE.has(o.id)) continue;
      const kept = byName.get(o.label);
      if (!kept || o.raw.blueprintPath.length < kept.raw.blueprintPath.length) byName.set(o.label, o);
    }
    const catalog = [...byName.values()]
      .map((o) => ({ id: o.id, label: o.label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
    const preparedCache = new Map<string, PreparedSpecies>();
    return {
      options,
      catalog,
      colors: m.ASA_COLORS,
      byId: (id) => byId.get(id),
      prepared(id, multipliers) {
        const key = `${id}|${JSON.stringify(multipliers)}`;
        let p = preparedCache.get(key);
        const raw = byId.get(id)?.raw;
        if (!p && raw) {
          p = prepareSpecies(raw, multipliers);
          preparedCache.set(key, p);
        }
        return p;
      },
    };
  });
  return loading;
}

export function useSpeciesData(): SpeciesData | null {
  const [data, setData] = useState<SpeciesData | null>(null);
  useEffect(() => {
    let active = true;
    loadSpeciesData().then((d) => active && setData(d));
    return () => {
      active = false;
    };
  }, []);
  return data;
}
