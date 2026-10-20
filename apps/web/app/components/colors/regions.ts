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

/** Parts of the drawn silhouette (not the game model: no rights involved, R-03). */
export type SilhouettePart = "body" | "back" | "spine" | "belly" | "head" | "limbs" | "pattern";

const PART_KEYWORDS: [SilhouettePart, RegExp][] = [
  ["belly", /belly|under|lower|chest|throat/],
  ["head", /head|face|facial|beak|horn|crest|eye|mask/],
  // before limbs and spine: "Wing Tips", "Spine tips", "Back stripes" are patterns
  ["pattern", /stripe|spot|pattern|highlight|accent|tip|marking|gradient|glow|emissive|light|border/],
  ["limbs", /leg|feet|foot|arm|hand|claw|wing/],
  ["spine", /spine|spike|plate|sail|fin|ridge/],
  ["back", /back|top|dorsal/],
  ["body", /body|main|skin|fur|scale|feather|base|primary|shell/],
];

/** Parts that take a region no keyword placed ("Secondary color"…), so every colour shows. */
const SPARE_PARTS: SilhouettePart[] = ["body", "back", "belly", "pattern", "limbs", "head", "spine"];

/**
 * Which region colours each part of the silhouette, from the region names of the species. A part
 * no region colours keeps the body colour (stripes are then left out).
 */
export function silhouetteColors(regions: readonly RegionColor[]): Record<SilhouettePart, RegionColor | null> {
  const parts: Record<SilhouettePart, RegionColor | null> = {
    body: null, back: null, spine: null, belly: null, head: null, limbs: null, pattern: null,
  };
  const left: RegionColor[] = [];
  for (const r of regions) {
    const name = r.name!.toLowerCase();
    const part = PART_KEYWORDS.find(([p, re]) => re.test(name) && !parts[p])?.[0];
    if (part) parts[part] = r;
    else left.push(r);
  }
  for (const r of left) {
    const part = SPARE_PARTS.find((p) => !parts[p]);
    if (part) parts[part] = r;
  }
  return parts;
}
