import { colorToHex, type ArkColor } from "@ark-breeding/core";

/** One colour region of a creature: its name for the species, and the colour it wears. */
export interface RegionColor {
  index: number;
  /** Region name from the ASB data ("Body Main", "Belly"…), null when the species does not use it. */
  name: string | null;
  color: ArkColor | null;
  hex: string;
}

/** The 6 regions of a creature, named for its species. Regions the species does not use are left out. */
export function regionColors(
  colorIds: readonly number[],
  regionNames: readonly (string | null)[] | undefined,
  colorById: ReadonlyMap<number, ArkColor>,
): RegionColor[] {
  return Array.from({ length: 6 }, (_, index) => {
    const color = colorById.get(colorIds[index] ?? 0) ?? null;
    return { index, name: regionNames?.[index] ?? null, color, hex: color ? colorToHex(color) : "transparent" };
  }).filter((r) => r.name && r.name !== "Unknown");
}
