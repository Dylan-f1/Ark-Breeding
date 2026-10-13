// ARK colours. Definitions are linear RGBA (Unreal); ids follow ASB's ArkColors for ASA.

export interface ArkColor {
  id: number;
  name: string;
  /** Linear RGBA as defined in the game files. */
  rgba: [number, number, number, number];
  dye?: boolean;
}

export const NO_COLOR_ID = 0;

/** ASB ArkColor.LinearColorComponentToColorComponentClamped: ARK's simplified gamma. */
function toDisplayComponent(linear: number): number {
  const v = Math.trunc(255.999 * Math.pow(Math.max(0, linear), 1 / 2.2));
  return Math.min(255, Math.max(0, v));
}

/** CSS colour (#rrggbb) of a colour definition. */
export function colorToHex(color: Pick<ArkColor, "rgba">): string {
  return `#${color.rgba
    .slice(0, 3)
    .map((c) => toDisplayComponent(c).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Id of the colour closest to linear RGBA values from an export file
 * (ASB ArkColors.ClosestColorId + ImportExported.ParseColorId).
 */
export function closestColorId(rgba: readonly number[], colors: readonly ArkColor[]): number {
  const [r = 0, g = 0, b = 0, a = 0] = rgba;
  if (r === 0 && g === 0 && b === 0 && a === 1) return NO_COLOR_ID;

  const exact = colors.find((c) => c.rgba[0] === r && c.rgba[1] === g && c.rgba[2] === b && c.rgba[3] === a);
  if (exact) return exact.id;

  let best = NO_COLOR_ID;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const c of colors) {
    const d = Math.hypot(c.rgba[0] - r, c.rgba[1] - g, c.rgba[2] - b, c.rgba[3] - a);
    if (d < bestDistance) {
      bestDistance = d;
      best = c.id;
    }
  }
  return best;
}
