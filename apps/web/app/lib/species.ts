import {
  OFFICIAL_SERVER_MULTIPLIERS,
  prepareSpecies,
  speciesIdFromBlueprint,
  type ArkColor,
  type PreparedSpecies,
  type RawSpecies,
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
  colors: readonly ArkColor[];
  byId(id: string): SpeciesOption | undefined;
  /** Species with the server multipliers applied (cached). */
  prepared(id: string): PreparedSpecies | undefined;
}

export function speciesLabel(raw: RawSpecies): string {
  const extra = raw.variants?.filter((v) => !raw.name.includes(v)) ?? [];
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
      isMainVariant: !raw.variants?.length,
      raw,
    })).sort((a, b) => Number(b.isMainVariant) - Number(a.isMainVariant) || a.label.localeCompare(b.label, "fr"));
    const byId = new Map(options.map((o) => [o.id, o]));
    const preparedCache = new Map<string, PreparedSpecies>();
    return {
      options,
      colors: m.ASA_COLORS,
      byId: (id) => byId.get(id),
      prepared(id) {
        let p = preparedCache.get(id);
        const raw = byId.get(id)?.raw;
        if (!p && raw) {
          // EF-05 (tribe server multipliers) will replace the official preset here.
          p = prepareSpecies(raw, OFFICIAL_SERVER_MULTIPLIERS);
          preparedCache.set(id, p);
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
