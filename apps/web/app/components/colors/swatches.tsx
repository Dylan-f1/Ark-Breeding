// The 6 colour regions of a creature as a swatch card each (EF-22).

import type { RegionColor } from "./regions";

/** One card per region, with the colour's name and number. */
export function RegionSwatches({ regions, mutated }: { regions: RegionColor[]; mutated?: readonly number[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
      {regions.map((r) => (
        <li key={r.index} className="flex items-center gap-3 rounded-md border p-2">
          <span className="size-12 shrink-0 rounded-md border" style={{ background: r.hex }} aria-hidden />
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium">{r.color?.name ?? "—"}</span>
            <span className="block truncate text-muted-foreground">
              Région {r.index} · {r.name}
            </span>
            {mutated?.includes(r.index) && (
              <span className="block text-xs font-medium text-amber-600 dark:text-amber-400">Mutation de couleur</span>
            )}
            <span className="block font-mono text-xs text-muted-foreground">
              {r.color ? `n° ${r.color.id} · ${r.hex.toUpperCase()}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
