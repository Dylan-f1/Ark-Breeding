// Driver around Extraction, ported from ASB Form1.extractor.cs ExtractLevels().

import { Extraction, type StatResult } from "./extraction";
import { Range, roundAwayFromZero } from "./math";
import type { PreparedSpecies } from "./species";
import { STATS_COUNT, Stat } from "./stats";

export type CreatureKind = "wild" | "tamed" | "bred";

export interface ExtractCreatureInput {
  species: PreparedSpecies;
  level: number;
  /** One value per stat index; percentage stats as factors (1.25 = 125 %); <= 0 = unknown. */
  statValues: number[];
  kind: CreatureKind;
  /** Possible taming effectiveness for tamed creatures, 0..1 (default 0..1). */
  tamingEffectiveness?: { min: number; max: number };
  /** Imprinting shown in game, 0..1. */
  imprintingBonus?: number;
  /** Trust the imprinting as given instead of recomputing it from torpidity / food. */
  exactImprinting?: boolean;
  /** Values come from an export file (full float precision). */
  highPrecisionInputs?: boolean;
  mutagenApplied?: boolean;
  domLevelsLockedToZero?: boolean[];
  /** Highest wild level of the server (150 on official ASA). */
  maxWildLevel?: number;
  allowMoreThanHundredImprinting?: boolean;
  /** Rank of the "Bonded Taming" talent: +10 % imprinting per rank on tamed creatures. */
  bondedTamingRank?: number;
}

export type ExtractionIssue =
  | "no-result" // at least one stat has no possible level combination
  | "total-level" // the level sums do not add up
  | "taming-effectiveness" // only TE-dependent stats failed: TE range too narrow
  | "max-wild-level"; // results dropped because of the server max wild level

export interface ExtractCreatureResult {
  valid: boolean;
  /** May differ from the input: a wild-claimed baby exported as bred is retried as tamed. */
  kind: CreatureKind;
  /** All possible level combinations per stat. */
  results: StatResult[][];
  /** Index into `results[stat]` of the most probable combination. */
  chosen: number[];
  /** True when every stat has exactly one possibility. */
  unique: boolean;
  levelWildMutSum: number;
  levelDomSum: number;
  imprintingBonus: number;
  imprintingChanged: boolean;
  /** >= 0 TE of the chosen results; -1 unknown; -2 inconsistent between stats. */
  tamingEffectiveness: number;
  issues: ExtractionIssue[];
  /**
   * Stats to point the player at when the extraction fails: those with no possible level on
   * their own; when each stat is plausible but the totals do not add up, torpidity (the total).
   */
  failedStats: number[];
  /** The extraction object, to re-filter after the player picks a possibility (EF-09). */
  extraction: Extraction;
}

export function extractCreature(input: ExtractCreatureInput): ExtractCreatureResult {
  const { species } = input;
  const extraction = new Extraction();
  let kind = input.kind;
  const issues: ExtractionIssue[] = [];
  const imprintingBonus = input.imprintingBonus ?? 0;
  const highPrecisionInputs = input.highPrecisionInputs ?? false;
  const mutagenApplied = input.mutagenApplied ?? false;

  // Stats with no possible level, kept from the attempt that came closest (the fallbacks below
  // can empty everything): that is what the player has to fix.
  let statsWithoutResult: number[] | null = null;
  const run = (imprintingBonusRounded = imprintingBonus) => {
    extraction.extractLevels({
      species,
      level: input.level,
      statValues: input.statValues,
      domLevelsLockedToZero: input.domLevelsLockedToZero,
      te: new Range(input.tamingEffectiveness?.min ?? 0, input.tamingEffectiveness?.max ?? 1),
      tamed: kind === "tamed",
      bred: kind === "bred",
      imprintingBonusRounded,
      adjustImprinting: !input.exactImprinting,
      allowMoreThanHundredImprinting: input.allowMoreThanHundredImprinting ?? false,
      highPrecisionInputs,
      mutagenApplied,
      fixedImprinting: kind === "tamed" ? (input.bondedTamingRank ?? 0) * 0.1 : -1,
    });
    const failing = extraction.results.map((r, s) => (r.length === 0 ? s : -1)).filter((s) => s >= 0);
    if (statsWithoutResult === null || failing.length < statsWithoutResult.length) statsWithoutResult = failing;
  };

  run();

  // Wild-claimed babies look bred in export files but extract as tamed.
  if (kind === "bred" && imprintingBonus === 0 && highPrecisionInputs) {
    const failing = extraction.results.map((r, s) => (r.length === 0 ? s : -1)).filter((s) => s >= 0);
    if (failing.length > 0 && failing.every((s) => extraction.statsWithTE.includes(s))) {
      extraction.clear();
      kind = "tamed";
      run();
    }
  }

  // Beyond ASB: an imprinting close to a half percent (68.49 % shown as 68 %) plus the rounding of
  // torpidity can push the exact value just outside ASB's ±0.5 % window. Shift the window once.
  if (kind === "bred" && !input.exactImprinting && !highPrecisionInputs && !extraction.everyStatHasAtLeastOneResult) {
    for (const shift of [0.005, -0.005]) {
      extraction.clear();
      run(imprintingBonus + shift);
      if (extraction.everyStatHasAtLeastOneResult) break;
    }
  }

  const everyStatHadAResult = extraction.everyStatHasAtLeastOneResult;
  const isTek = species.name.startsWith("Tek ");
  const additionalWildLevelsDueToMutagen = mutagenApplied ? (kind === "bred" ? 5 : 20) : 0;
  extraction.removeImpossibleTEsAccordingToMaxWildLevel(
    Math.ceil(((input.maxWildLevel ?? 150) + additionalWildLevelsDueToMutagen) * (isTek ? 1.2 : 1)),
  );
  if (everyStatHadAResult && !extraction.everyStatHasAtLeastOneResult) issues.push("max-wild-level");

  const filtered = extraction.setStatLevelBoundsAndFilter();
  if (!filtered.valid && filtered.statError === -1) issues.push("total-level");

  // pick, per stat, the wild level closest to the mean (most probable)
  let statsWithLevels = 0;
  for (let s = 0; s < STATS_COUNT; s++)
    if (s !== Stat.Torpidity && species.canLevelUpWildOrHaveMutations(s)) statsWithLevels++;
  const meanWildLevel = roundAwayFromZero(extraction.levelWildMutSum / Math.max(1, statsWithLevels), 1);

  let unique = true;
  let valid = extraction.validResults;
  for (let s = 0; s < STATS_COUNT; s++) {
    const results = extraction.results[s]!;
    if (results.length === 0) {
      valid = false;
      if (kind === "tamed" && extraction.statsWithTE.includes(s)) issues.push("taming-effectiveness");
      continue;
    }
    let r = 0;
    for (let b = 1; b < results.length; b++) {
      if (Math.abs(meanWildLevel - results[b]!.levelWild) < Math.abs(meanWildLevel - results[r]!.levelWild)) r = b;
    }
    extraction.chosenResults[s] = r;
    if (results.length > 1) unique = false;
  }
  if (!valid && !issues.includes("total-level")) issues.push("no-result");
  extraction.uniqueResults = valid && unique;
  // assigned inside run(): TypeScript cannot follow that
  const closestFailures = statsWithoutResult as number[] | null;

  return {
    valid,
    kind,
    results: extraction.results,
    chosen: [...extraction.chosenResults],
    unique: extraction.uniqueResults,
    levelWildMutSum: extraction.levelWildMutSum,
    levelDomSum: extraction.levelDomSum,
    imprintingBonus: extraction.imprintingBonus,
    imprintingChanged: extraction.imprintingChanged,
    tamingEffectiveness: valid ? extraction.uniqueTamingEffectiveness() : -1,
    issues: [...new Set(issues)],
    failedStats: valid
      ? []
      : closestFailures?.length
        ? closestFailures
        : filtered.statError >= 0
          ? [filtered.statError, Stat.Torpidity]
          : [Stat.Torpidity],
    extraction,
  };
}
