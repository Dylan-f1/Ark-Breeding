import {
  buildCatalog,
  isOwnSpecies,
  prepareSpecies,
  speciesIdFromBlueprint,
  speciesLabel,
  type ArkColor,
  type CatalogEntry,
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
  catalog: CatalogEntry[];
  colors: readonly ArkColor[];
  byId(id: string): SpeciesOption | undefined;
  /** Species with the tribe's server multipliers applied (EF-05), cached per settings. */
  prepared(id: string, multipliers: ServerMultipliers): PreparedSpecies | undefined;
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
    const catalog = buildCatalog(m.ASA_SPECIES);
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
