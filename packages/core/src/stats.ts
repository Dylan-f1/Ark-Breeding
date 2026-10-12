// Stat indices as used by the game files and ASB (ARKBreedingStats/Ark.cs, class Stats).

export const STATS_COUNT = 12;

export const Stat = {
  Health: 0,
  Stamina: 1,
  Torpidity: 2,
  Oxygen: 3,
  Food: 4,
  Water: 5,
  Temperature: 6,
  Weight: 7,
  MeleeDamage: 8,
  Speed: 9,
  TemperatureFortitude: 10,
  CraftingSpeed: 11,
} as const;

export type StatIndex = (typeof Stat)[keyof typeof Stat];

export const STAT_INDICES = Array.from({ length: STATS_COUNT }, (_, i) => i as StatIndex);

/** Order of the stats in the in-game inventory. */
export const STAT_DISPLAY_ORDER: readonly StatIndex[] = [
  Stat.Health,
  Stat.Stamina,
  Stat.Oxygen,
  Stat.Food,
  Stat.Water,
  Stat.Temperature,
  Stat.Weight,
  Stat.MeleeDamage,
  Stat.Speed,
  Stat.TemperatureFortitude,
  Stat.CraftingSpeed,
  Stat.Torpidity,
];

export const STAT_NAMES_FR: Record<StatIndex, string> = {
  0: "Vie",
  1: "Endurance",
  2: "Torpeur",
  3: "Oxygène",
  4: "Nourriture",
  5: "Eau",
  6: "Température",
  7: "Poids",
  8: "Dégâts de mêlée",
  9: "Vitesse",
  10: "Résistance à la température",
  11: "Vitesse d'artisanat",
};

/** Melee, speed and crafting speed are shown as percentages; values are stored as factors (1.25 = 125 %). */
export function isPercentageStat(stat: number): boolean {
  return stat === Stat.MeleeDamage || stat === Stat.Speed || stat === Stat.CraftingSpeed;
}

/** Decimal digits the game displays: percentages have 3 (as a factor), the rest 1. */
export function statPrecision(stat: number): number {
  return isPercentageStat(stat) ? 3 : 1;
}
