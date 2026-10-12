// Port of ASB's level extraction (ARKBreedingStats/Extraction.cs and the driver in
// Form1.extractor.cs). From the stat values a creature shows, it finds every combination of
// wild / mutated / domesticated levels (and taming effectiveness) that produces them.
// Structure and names follow the C# code on purpose, to keep both easy to compare.
// Not ported yet: the Troodonism bug (species with altBaseStats) and singleplayer settings.

import { IntRange, Range, floatPrecision, roundHalfEven } from "./math";
import type { PreparedSpecies } from "./species";
import { calculateStatValue, preTameWildLevel } from "./stat-value";
import { STATS_COUNT, Stat, statPrecision } from "./stats";

export interface StatResult {
  levelWild: number;
  levelMut: number;
  levelDom: number;
  /** Taming effectiveness range for stats affected by it; [-1, -1] otherwise. */
  te: Range;
  currentlyNotValid: boolean;
}

function statResult(levelWild: number, levelDom: number, te?: Range, levelMut = 0): StatResult {
  return { levelWild, levelMut, levelDom, te: te ?? new Range(-1), currentlyNotValid: false };
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Mutagen adds 5 levels to 4 stats of a non-bred creature. */
const MUTAGEN_TOTAL_LEVEL_UPS_NON_BRED = 20;
const DEFAULT_CUDDLE_INTERVAL_S = 8 * 60 * 60;

/**
 * Tolerance of a stat value (ASB StatValueCalculation.DisplayedAberration).
 * The game shows one decimal; export files carry the full float.
 */
export function displayedAberration(value: number, decimals: number, highPrecisionInput: boolean): number {
  const arkDisplayValueError = Math.fround(0.06);
  const minValueError = Math.fround(0.001);
  const calculationErrorFactor = 20;
  return highPrecisionInput || value * (decimals === 3 ? 100 : 1) > 1e6
    ? Math.max(minValueError, Math.fround(floatPrecision(Math.fround(value)) * calculationErrorFactor))
    : Math.fround(arkDisplayValueError * (decimals === 3 ? Math.fround(0.01) : 1));
}

/** Imprinting gained per cuddle (0 if the species cannot be raised). Port of Ark.ImprintingGainPerCuddle(). */
export function imprintingGainPerCuddle(species: PreparedSpecies): number {
  const maturationTime = species.maturationTimeAdjusted;
  if (!maturationTime) return 0;
  const m = species.multipliers;
  const maxPossibleCuddles = maturationTime / (DEFAULT_CUDDLE_INTERVAL_S * m.babyImprintAmountMultiplier);
  const denominator = maxPossibleCuddles - 0.25;
  if (denominator < m.babyCuddleIntervalMultiplier) return 1;
  return Math.min(1, m.babyCuddleIntervalMultiplier / denominator);
}

export interface ExtractLevelsInput {
  species: PreparedSpecies;
  /** Total character level shown in game. */
  level: number;
  /** One value per stat index; percentage stats as factors (1.25 = 125 %); <= 0 = unknown. */
  statValues: number[];
  domLevelsLockedToZero?: boolean[];
  /** Possible taming effectiveness, 0..1. */
  te: Range;
  tamed: boolean;
  bred: boolean;
  /** Imprinting as shown in game (rounded), 0..1. */
  imprintingBonusRounded: number;
  /** Compute the exact imprinting from torpidity / food instead of trusting the rounded value. */
  adjustImprinting: boolean;
  allowMoreThanHundredImprinting: boolean;
  considerWildLevelSteps?: boolean;
  wildLevelSteps?: number;
  /** Values come from an export file (full float precision). */
  highPrecisionInputs: boolean;
  mutagenApplied: boolean;
  /** If >= 0, imprinting is assumed to be exactly this. */
  fixedImprinting?: number;
}

export class Extraction {
  results: StatResult[][] = Array.from({ length: STATS_COUNT }, () => []);
  readonly chosenResults: number[] = Array<number>(STATS_COUNT).fill(0);
  readonly fixedResults: boolean[] = Array<boolean>(STATS_COUNT).fill(false);
  statsWithTE: number[] = [];
  validResults = false;
  uniqueResults = false;
  postTamed = false;
  private bred = false;
  private lowerBoundWilds = Array<number>(STATS_COUNT).fill(0);
  private lowerBoundDoms = Array<number>(STATS_COUNT).fill(0);
  private upperBoundDoms = Array<number>(STATS_COUNT).fill(0);
  private levelsUndeterminedWild = 0;
  private levelsUndeterminedDom = 0;
  /** Sum of wild and mutated levels. */
  levelWildMutSum = 0;
  levelDomSum = 0;
  private imprintingBonusRange = new Range(0);
  imprintingBonus = 0;
  imprintingChanged = false;
  resultWasSortedOutBecauseOfImpossibleTe = false;
  /** A stat has several possibilities, at least one with mutated levels. */
  mutationLevelPossibilities = false;

  clear() {
    for (let s = 0; s < STATS_COUNT; s++) {
      this.chosenResults[s] = 0;
      this.fixedResults[s] = false;
      this.results[s] = [];
      this.lowerBoundWilds[s] = 0;
      this.lowerBoundDoms[s] = 0;
      this.upperBoundDoms[s] = 0;
    }
    this.validResults = false;
    this.uniqueResults = false;
    this.resultWasSortedOutBecauseOfImpossibleTe = false;
    this.statsWithTE = [];
    this.imprintingBonusRange = new Range(0);
    this.imprintingBonus = 0;
    this.levelWildMutSum = 0;
    this.levelDomSum = 0;
  }

  get everyStatHasAtLeastOneResult(): boolean {
    return this.results.every((r) => r.length > 0);
  }

  extractLevels(input: ExtractLevelsInput): void {
    const { species, level, statValues, tamed, bred } = input;
    const stats = species.stats;
    const domLevelsLockedToZero = input.domLevelsLockedToZero ?? Array<boolean>(STATS_COUNT).fill(false);
    const torpor = stats[Stat.Torpidity];

    this.validResults = true;
    this.imprintingChanged = false;
    if (!torpor || torpor.baseValue === 0 || torpor.incPerWildLevel === 0) {
      this.validResults = false;
      return;
    }

    const considerWildLevelSteps =
      !!input.considerWildLevelSteps &&
      !bred &&
      !input.mutagenApplied &&
      species.name.slice(0, 3) !== "Tek" &&
      species.name !== "Jerboa";
    const wildLevelSteps = input.wildLevelSteps ?? 5;

    this.bred = bred;
    this.postTamed = bred || tamed;

    const fixedImprinting = input.fixedImprinting ?? -1;
    const imprintingBonusMultiplier = species.multipliers.babyImprintingStatScaleMultiplier;
    let imprintingBonusList: Range[];
    if (fixedImprinting >= 0) imprintingBonusList = [new Range(fixedImprinting)];
    else if (bred)
      imprintingBonusList = input.adjustImprinting
        ? calculateImprintingBonus(
            species,
            input.imprintingBonusRounded,
            imprintingBonusMultiplier,
            statValues[Stat.Torpidity] ?? 0,
            statValues[Stat.Food] ?? 0,
          )
        : [new Range(input.imprintingBonusRounded)];
    else imprintingBonusList = [new Range(0)];

    const statImprintMultipliers = species.statImprintMultipliers;
    const ibMax = input.allowMoreThanHundredImprinting ? 5 : 1;
    let te = Range.of(input.te);

    for (let ibi = 0; ibi < imprintingBonusList.length; ibi++) {
      this.imprintingBonusRange = Range.of(imprintingBonusList[ibi]!);
      // keep a 0.01 margin so possible values are not cut off
      this.imprintingBonusRange.intersect(new Range(-0.01, input.allowMoreThanHundredImprinting ? 5 : 1.01));
      this.imprintingBonus = Math.max(0, Math.min(ibMax, this.imprintingBonusRange.mean));

      const imprintingMultiplierRanges: Range[] = [];
      for (let s = 0; s < STATS_COUNT; s++) {
        // the tamed base health multiplier is always linked with imprinting, so fold it in here
        const tbhm =
          this.postTamed && s === Stat.Health && species.tamedBaseHealthMultiplier != null
            ? species.tamedBaseHealthMultiplier
            : 1;
        const m = statImprintMultipliers[s] ?? 0;
        imprintingMultiplierRanges[s] =
          m !== 0
            ? new Range(
                (1 + this.imprintingBonusRange.min * imprintingBonusMultiplier * m) * tbhm,
                (1 + this.imprintingBonusRange.max * imprintingBonusMultiplier * m) * tbhm,
              )
            : new Range(tbhm);
      }

      const torporValue = statValues[Stat.Torpidity] ?? 0;
      const additiveTamingBonusTorpidity = this.postTamed ? torpor.addWhenTamed : 0;
      const imrT = imprintingMultiplierRanges[Stat.Torpidity]!;
      const levelWildSumRange = new IntRange(
        roundHalfEven(((torporValue - additiveTamingBonusTorpidity) / (imrT.max * torpor.baseValue) - 1) / torpor.incPerWildLevel),
        roundHalfEven(((torporValue - additiveTamingBonusTorpidity) / (imrT.min * torpor.baseValue) - 1) / torpor.incPerWildLevel),
      );
      const levelDomSumRange = new IntRange(
        Math.max(0, level - 1 - levelWildSumRange.max),
        Math.max(0, level - 1 - levelWildSumRange.min),
      );

      this.levelWildMutSum = levelWildSumRange.min;
      this.levelDomSum = levelDomSumRange.min;
      this.levelsUndeterminedWild = this.levelWildMutSum;
      this.levelsUndeterminedDom = this.levelDomSum;

      // bred creatures always have 100 % TE; otherwise widen a bit against double precision errors
      te = bred ? new Range(1) : new Range(Math.max(0, te.min - 0.0006), te.max + 0.0006);

      for (let s = 0; s < STATS_COUNT; s++) {
        const st = stats[s];
        if (!species.usesStat(s) || !st) {
          this.results[s]!.push(statResult(0, 0));
          continue;
        }
        const value = statValues[s] ?? 0;
        if (value <= 0) {
          // unknown value (e.g. oxygen not shown)
          this.results[s]!.push(statResult(-1, 0));
          continue;
        }

        const tolerance = displayedAberration(value, statPrecision(s), input.highPrecisionInputs);
        const statValue = new Range(value - tolerance, value + tolerance);
        const statBaseValue = st.baseValue;
        const imr = imprintingMultiplierRanges[s]!;

        const teAffectsStatValue = this.postTamed && st.multAffinity > 0;
        if (teAffectsStatValue) this.statsWithTE.push(s);

        let minLw = 0;
        let maxLw = 0;
        const minLm = 0;
        let maxLm = 0;

        const increaseStatAsPercentage = st.increaseStatAsPercentage;
        const increasePerWildLevel = st.incPerWildLevel * (increaseStatAsPercentage ? st.baseValue : 1);
        const increasePerMutLevel = st.incPerMutatedLevel * (increaseStatAsPercentage ? st.baseValue : 1);
        const customMutationLevelIncrease = increasePerMutLevel > 0 && increasePerMutLevel !== increasePerWildLevel;

        const additiveTameBonus = this.postTamed ? st.addWhenTamed : 0;
        let multAffinityFactor = new Range(1);

        if (species.canLevelUpWildOrHaveMutations(s)) {
          if (st.incPerWildLevel > 0) {
            if (this.postTamed) {
              const multAffinityBaseFactor = st.multAffinity;
              // only a positive bonus scales with TE
              multAffinityFactor =
                multAffinityBaseFactor > 0
                  ? new Range(multAffinityBaseFactor * te.min + 1, multAffinityBaseFactor * te.max + 1)
                  : new Range(multAffinityBaseFactor + 1);
            }

            // floor is too imprecise
            maxLw = roundHalfEven(
              ((statValue.max / multAffinityFactor.min - additiveTameBonus) / imr.min - statBaseValue) / increasePerWildLevel,
            );
            if (customMutationLevelIncrease)
              maxLm = roundHalfEven(
                ((statValue.max / multAffinityFactor.min - additiveTameBonus) / imr.min - statBaseValue) / increasePerMutLevel,
              );
          } else {
            minLw = -1;
            maxLw = -1;
          }
        }

        if (maxLw > this.levelWildMutSum) maxLw = this.levelWildMutSum;

        let maxLd = 0;
        if (!domLevelsLockedToZero[s] && this.postTamed && species.displaysStat(s) && st.incPerTamedLevel > 0) {
          // lowest wild level at which a tamed creature with a negative base stat is alive (e.g. Griffin)
          let minWildLevelAlive = 0;
          if (statBaseValue + st.addWhenTamed < 0) {
            while (
              minWildLevelAlive < 10000 &&
              calculateStatValue(species, s, { wild: minWildLevelAlive }, { tamed: true, tamingEffectiveness: te.min, round: false }) <= 0
            )
              minWildLevelAlive++;
          }

          const postTameValue =
            ((statBaseValue + increasePerWildLevel * minWildLevelAlive) * imr.min + additiveTameBonus) * multAffinityFactor.min;
          if (postTameValue === 0 && increaseStatAsPercentage) maxLd = 0;
          // floor is sometimes too low, so using round
          else
            maxLd = roundHalfEven(
              (statValue.max - postTameValue) /
                (increaseStatAsPercentage ? postTameValue * st.incPerTamedLevel : st.incPerTamedLevel),
            );
        }
        if (maxLd > this.levelsUndeterminedDom) maxLd = this.levelsUndeterminedDom;
        if (maxLd < 0) maxLd = 0;

        // dom levels have no effect: only the wild level can be calculated
        if (st.incPerTamedLevel === 0) {
          if (st.incPerWildLevel === 0) {
            const possibleStatValues = new Range(
              calculateStatValue(species, s, { wild: 0 }, { tamed: this.postTamed, tamingEffectiveness: te.min, imprintingBonus: this.imprintingBonusRange.min, round: false }),
              calculateStatValue(species, s, { wild: 0 }, { tamed: this.postTamed, tamingEffectiveness: te.max, imprintingBonus: this.imprintingBonusRange.max, round: false }),
            );
            if (statValue.overlaps(possibleStatValues)) this.results[s]!.push(statResult(0, 0));
          } else {
            const lwRange = IntRange.fromDoubles(
              ((statValue.min / multAffinityFactor.max - additiveTameBonus) / imr.max - statBaseValue) / increasePerWildLevel,
              ((statValue.max / multAffinityFactor.min - additiveTameBonus) / imr.min - statBaseValue) / increasePerWildLevel,
            );

            if (customMutationLevelIncrease) {
              const lmRange = IntRange.fromDoubles(
                ((statValue.min / multAffinityFactor.max - additiveTameBonus) / imr.max - statBaseValue) / increasePerMutLevel,
                ((statValue.max / multAffinityFactor.min - additiveTameBonus) / imr.min - statBaseValue) / increasePerMutLevel,
              );
              if (!lmRange.valid) continue;
              const tmNotZero = st.multAffinity !== 0;
              // ASB's loop here increments the wrong variable; this iterates both ranges as intended.
              for (let lw = lwRange.min; lw <= lwRange.max; lw++) {
                for (let lm = lmRange.min; lm <= lmRange.max; lm++) {
                  const raw = statBaseValue + increasePerWildLevel * lw + increasePerMutLevel * lm;
                  const valueBeforeTe = new Range(raw * imr.min + additiveTameBonus, raw * imr.max + additiveTameBonus);
                  if (teAffectsStatValue) {
                    const neededTe = new Range(
                      (statValue.min / valueBeforeTe.max - 1) / st.multAffinity,
                      (statValue.max / valueBeforeTe.min - 1) / st.multAffinity,
                    );
                    if (neededTe.intersect(te)) this.results[s]!.push(statResult(lw, 0, neededTe, lm));
                  } else if (tmNotZero) {
                    if (statValue.includesRange(valueBeforeTe.times(1 + st.multAffinity)))
                      this.results[s]!.push(statResult(lw, 0, undefined, lm));
                  } else if (statValue.includesRange(valueBeforeTe)) {
                    this.results[s]!.push(statResult(lw, 0, undefined, lm));
                  }
                }
              }
            } else {
              const lw = roundHalfEven(lwRange.mean);
              if (lwRange.includes(lw) && lw >= 0 && lw <= maxLw) this.results[s]!.push(statResult(lw, 0));
            }
          }
          // even without a result there is no other valid one
          continue;
        }

        let sortedOutBecauseOfImpossibleTe = false;
        const multBonusWoTe = this.postTamed ? 1 + st.multAffinity : 1;
        for (let lw = minLw; lw <= maxLw; lw++) {
          for (let lm = minLm; lm <= maxLm; lm++) {
            const raw = statBaseValue + increasePerWildLevel * lw + increasePerMutLevel * lm;
            const valueWoTeWoDomRange = new Range(raw * imr.min + additiveTameBonus, raw * imr.max + additiveTameBonus);

            if (!teAffectsStatValue) {
              // the only possible dom level: take it if it is an integer
              const valueWoDomRange = valueWoTeWoDomRange.times(multBonusWoTe);
              if (st.incPerTamedLevel > 0) {
                const effectiveIncPerDomLevel = (increaseStatAsPercentage ? valueWoDomRange : new Range(1)).times(st.incPerTamedLevel);
                const ldRange = IntRange.fromDoubles(
                  (statValue.min - valueWoDomRange.max) / effectiveIncPerDomLevel.max,
                  (statValue.max - valueWoDomRange.min) / effectiveIncPerDomLevel.min,
                );
                const ld = roundHalfEven(ldRange.mean);
                if (ldRange.includes(ld) && ld >= 0 && ld <= maxLd) this.results[s]!.push(statResult(lw, ld, undefined, lm));
              } else if (statValue.includesRange(valueWoDomRange)) {
                this.results[s]!.push(statResult(lw, 0, undefined, lm));
              }
              continue;
            }

            for (let ld = 0; ld <= maxLd; ld++) {
              const calculatedTe = increaseStatAsPercentage
                ? new Range(
                    (statValue.min / ((1 + ld * st.incPerTamedLevel) * valueWoTeWoDomRange.max) - 1) / st.multAffinity,
                    (statValue.max / ((1 + ld * st.incPerTamedLevel) * valueWoTeWoDomRange.min) - 1) / st.multAffinity,
                  )
                : new Range(
                    ((statValue.min - ld * st.incPerTamedLevel) / valueWoTeWoDomRange.max - 1) / st.multAffinity,
                    ((statValue.max - ld * st.incPerTamedLevel) / valueWoTeWoDomRange.min - 1) / st.multAffinity,
                  );

              if (calculatedTe.min > te.max) continue;
              // TE only decreases further in this loop
              if (calculatedTe.max < te.min) break;
              calculatedTe.intersect(te);

              if (!bred) {
                // the total level must be reachable with this TE through the taming level bonus
                const levelPostTame = this.levelWildMutSum + 1 - (input.mutagenApplied ? MUTAGEN_TOTAL_LEVEL_UPS_NON_BRED : 0);
                const levelPreTameRange = new IntRange(
                  preTameWildLevel(levelPostTame, calculatedTe.max),
                  preTameWildLevel(levelPostTame, calculatedTe.min),
                );

                let impossibleTe = true;
                for (let wildLevel = levelPreTameRange.min; wildLevel <= levelPreTameRange.max; wildLevel++) {
                  const levelPostTameRange = new IntRange(
                    Math.floor(wildLevel * (1 + calculatedTe.min / 2)),
                    Math.floor(wildLevel * (1 + calculatedTe.max / 2)),
                  );
                  if (levelPostTameRange.includes(levelPostTame)) {
                    impossibleTe = false;
                    break;
                  }
                }
                if (impossibleTe) {
                  sortedOutBecauseOfImpossibleTe = true;
                  continue;
                }

                if (considerWildLevelSteps) {
                  let validWildLevel = false;
                  for (let wildLevel = levelPreTameRange.min; wildLevel <= levelPreTameRange.max; wildLevel++) {
                    if (wildLevel % wildLevelSteps === 0) {
                      validWildLevel = true;
                      break;
                    }
                  }
                  if (!validWildLevel) continue;
                }

                // a creature has a single TE: it must overlap the TE of the first TE-dependent stat
                if (this.statsWithTE.length > 1) {
                  const first = this.results[this.statsWithTE[0]!]!;
                  if (!first.some((r) => calculatedTe.overlaps(r.te))) continue;
                }
              }

              this.results[s]!.push(statResult(lw, ld, calculatedTe, lm));
            }
          }
        }

        if (sortedOutBecauseOfImpossibleTe && this.results[s]!.length === 0)
          this.resultWasSortedOutBecauseOfImpossibleTe = true;
      }

      if (bred) {
        if (this.everyStatHasAtLeastOneResult) {
          // all stats have a result: keep this imprinting
          this.imprintingChanged = Math.abs(input.imprintingBonusRounded - this.imprintingBonus) > 0.01;
          this.mutationLevelPossibilities = this.results.some((sr) => sr.length > 1 && sr.some((r) => r.levelMut > 0));
          break;
        }
        if (ibi < imprintingBonusList.length - 1) {
          this.clear();
          this.validResults = true;
        }
      }
    }
  }

  removeImpossibleTEsAccordingToMaxWildLevel(maxWildLevel: number): void {
    if (this.bred || maxWildLevel <= 0 || this.levelWildMutSum + 1 <= maxWildLevel) return;
    const minTeCheck = (2 * (this.levelWildMutSum + 1 - maxWildLevel)) / maxWildLevel;
    // a minimum TE >= 1 means the creature can only be bred: nothing to sort out
    if (!(minTeCheck < 1)) return;
    for (let s = 0; s < STATS_COUNT; s++) {
      const r = this.results[s]!;
      if (r.length === 0 || r[0]!.te.max < 0) continue;
      this.results[s] = r.filter((x) => !(x.te.max < minTeCheck));
    }
  }

  /** Removes results that violate the level sums; returns the faulty stat index in `statError` (-1 = total level). */
  setStatLevelBoundsAndFilter(): { valid: boolean; statError: number } {
    this.levelsUndeterminedWild = this.levelWildMutSum;
    this.levelsUndeterminedDom = this.levelDomSum;
    for (let s = 0; s < STATS_COUNT; s++) {
      if (s === Stat.Torpidity) continue;
      this.adjustBoundsToStatResults(s);
    }
    if (this.levelsUndeterminedWild < sum(this.lowerBoundWilds) || this.levelsUndeterminedDom < sum(this.lowerBoundDoms)) {
      this.clear();
      this.validResults = false;
      return { valid: false, statError: -1 };
    }

    let filterBoundsAndTEAgain: boolean;
    do {
      filterBoundsAndTEAgain = false;
      let filterBoundsAgain: boolean;
      do {
        filterBoundsAgain = false;
        for (let s = 0; s < STATS_COUNT; s++) {
          if (s === Stat.Torpidity) continue;
          const results = this.results[s]!;
          for (let r = 0; r < results.length; r++) {
            const res = results[r]!;
            if (
              results.length > 1 &&
              (res.levelWild > this.levelsUndeterminedWild - sum(this.lowerBoundWilds) + this.lowerBoundWilds[s]! ||
                res.levelDom > this.levelsUndeterminedDom - sum(this.lowerBoundDoms) + this.lowerBoundDoms[s]! ||
                res.levelDom < this.levelsUndeterminedDom - sum(this.upperBoundDoms) + this.upperBoundDoms[s]!)
            ) {
              const adjustBounds =
                res.levelWild === this.lowerBoundWilds[s] ||
                res.levelDom === this.lowerBoundDoms[s] ||
                res.levelDom === this.upperBoundDoms[s];
              results.splice(r--, 1);

              if (results.length === 1 || adjustBounds) {
                filterBoundsAgain = this.adjustBoundsToStatResults(s) || filterBoundsAgain;
                if (this.levelsUndeterminedWild < 0 || this.levelsUndeterminedDom < 0) {
                  this.results[s] = [];
                  this.validResults = false;
                  return { valid: false, statError: s };
                }
              }
            }
          }
        }
      } while (filterBoundsAgain);

      // all TE-dependent stats must share one TE (not needed for bred creatures: TE is 1)
      if (!this.bred && this.statsWithTE.length > 1) {
        for (let es = 0; es < this.statsWithTE.length - 1; es++) {
          for (let et = es + 1; et < this.statsWithTE.length; et++) {
            const sA = this.statsWithTE[es]!;
            const sB = this.statsWithTE[et]!;
            const equalA = new Set<number>();
            const equalB = new Set<number>();
            this.results[sA]!.forEach((ra, ia) =>
              this.results[sB]!.forEach((rb, ib) => {
                if (ra.te.overlaps(rb.te)) {
                  equalA.add(ia);
                  equalB.add(ib);
                }
              }),
            );

            const oldA = this.results[sA]!.length;
            this.results[sA] = [...equalA].map((i) => this.results[sA]![i]!);
            const removedA = oldA !== this.results[sA]!.length;
            if (removedA) filterBoundsAndTEAgain = this.adjustBoundsToStatResults(sA);

            const oldB = this.results[sB]!.length;
            this.results[sB] = [...equalB].map((i) => this.results[sB]![i]!);
            const removedB = oldB !== this.results[sB]!.length;
            if (removedB) filterBoundsAndTEAgain = this.adjustBoundsToStatResults(sB) || filterBoundsAndTEAgain;

            if ((removedA || removedB) && et > 1) {
              es = -1;
              et = this.statsWithTE.length;
            }
          }
        }
      }
    } while (filterBoundsAndTEAgain);
    return { valid: this.validResults, statError: -1 };
  }

  private adjustBoundsToStatResults(s: number): boolean {
    const results = this.results[s]!;
    let changed = false;
    if (results.length === 1) {
      // unknown stats (-1) are ignored in the bounds
      if (results[0]!.levelWild > 0) this.levelsUndeterminedWild -= results[0]!.levelWild;
      if (results[0]!.levelDom > 0) this.levelsUndeterminedDom -= results[0]!.levelDom;
      this.lowerBoundWilds[s] = 0;
      this.lowerBoundDoms[s] = 0;
      this.upperBoundDoms[s] = 0;
      changed = true;
    } else if (results.length > 1) {
      let minW = results[0]!.levelWild;
      let minD = results[0]!.levelDom;
      let maxD = results[0]!.levelDom;
      for (const r of results) {
        minW = Math.min(minW, r.levelWild);
        minD = Math.min(minD, r.levelDom);
        maxD = Math.max(maxD, r.levelDom);
      }
      changed = this.lowerBoundWilds[s] !== minW || this.lowerBoundDoms[s] !== minD || this.upperBoundDoms[s] !== maxD;
      this.lowerBoundWilds[s] = minW;
      this.lowerBoundDoms[s] = minD;
      this.upperBoundDoms[s] = maxD;
    }
    return changed;
  }

  /** Marks results incompatible with the fixed choices; returns the faulty stat index or -1. */
  filterResultsByFixed(dontFix = -1): number {
    const lowBoundWs = [...this.lowerBoundWilds];
    const lowBoundDs = [...this.lowerBoundDoms];
    const uppBoundDs = [...this.upperBoundDoms];
    let wildMax = this.levelsUndeterminedWild;
    let dom = this.levelsUndeterminedDom;

    for (let s = 0; s < STATS_COUNT; s++) {
      if (s === Stat.Torpidity) continue;
      this.results[s]!.forEach((r, i) => {
        r.currentlyNotValid = this.fixedResults[s]! && dontFix !== s && i !== this.chosenResults[s];
      });
      if (this.fixedResults[s] && dontFix !== s) {
        const chosen = this.results[s]![this.chosenResults[s]!]!;
        wildMax -= chosen.levelWild;
        dom -= chosen.levelDom;
        lowBoundWs[s] = 0;
        lowBoundDs[s] = 0;
        uppBoundDs[s] = 0;
      }
    }

    let loopAgain = true;
    while (loopAgain) {
      loopAgain = false;
      for (let s = 0; s < STATS_COUNT; s++) {
        if (s === Stat.Torpidity) continue;
        const results = this.results[s]!;
        let validCount = results.filter((r) => !r.currentlyNotValid).length;
        if (validCount <= 1) continue;
        for (const r of results) {
          if (
            !r.currentlyNotValid &&
            (r.levelWild > wildMax - sum(lowBoundWs) + lowBoundWs[s]! ||
              r.levelDom > dom - sum(lowBoundDs) + lowBoundDs[s]! ||
              r.levelDom < dom - sum(uppBoundDs) + uppBoundDs[s]!)
          ) {
            r.currentlyNotValid = true;
            validCount--;
            if (validCount === 1) {
              const unique = results.find((x) => !x.currentlyNotValid)!;
              loopAgain = true;
              wildMax -= unique.levelWild;
              dom -= unique.levelDom;
              lowBoundWs[s] = 0;
              lowBoundDs[s] = 0;
              uppBoundDs[s] = 0;
              if (wildMax < 0 || dom < 0) return s;
              break;
            }
          }
        }
      }
    }
    return -1;
  }

  /** TE of the chosen results: >= 0 valid, -1 unknown, -2 inconsistent between stats. */
  uniqueTamingEffectiveness(): number {
    const first = this.statsWithTE[0];
    if (first === undefined || this.results[first]!.length <= this.chosenResults[first]!) return -1;
    const chosenTe = (s: number) => this.results[s]![this.chosenResults[s]!]?.te;
    for (let i = 0; i < this.statsWithTE.length; i++) {
      for (let j = i + 1; j < this.statsWithTE.length; j++) {
        const a = chosenTe(this.statsWithTE[i]!);
        const b = chosenTe(this.statsWithTE[j]!);
        if (!a || !b || !a.overlaps(b)) return -2;
      }
    }
    const te = Range.of(chosenTe(first)!);
    for (const s of this.statsWithTE.slice(1)) te.intersect(chosenTe(s)!);
    return te.mean;
  }
}

/**
 * Exact imprinting from the rounded value shown in game, using torpidity (never levelled)
 * and food (high values, rarely levelled). Port of Extraction.CalculateImprintingBonus().
 */
function calculateImprintingBonus(
  species: PreparedSpecies,
  imprintingBonusRounded: number,
  imprintingBonusMultiplier: number,
  torpor: number,
  food: number,
): Range[] {
  if (imprintingBonusMultiplier === 0) return [new Range(imprintingBonusRounded)];
  const stats = species.stats;
  const t = stats[Stat.Torpidity]!;
  if (t.baseValue === 0 || t.incPerWildLevel === 0)
    return [new Range(imprintingBonusRounded - 0.005, imprintingBonusRounded + 0.005)];

  const mult = species.statImprintMultipliers;
  if (!mult.some((m) => m !== 0)) return [new Range(imprintingBonusRounded)];
  if (mult[Stat.Torpidity] === 0) return [new Range(imprintingBonusRounded - 0.005, imprintingBonusRounded + 0.005)];

  // with cuddles only (no event, no mod) the imprinting grows in fixed steps: the most exact value
  let imprintingBonusFromGainPerCuddle = 0;
  const gain = imprintingGainPerCuddle(species);
  if (gain > 0) imprintingBonusFromGainPerCuddle = roundHalfEven(imprintingBonusRounded / gain) * gain;

  const wildLevelsFrom = (value: number, st: NonNullable<(typeof stats)[number]>, m: number) =>
    IntRange.fromDoubles(
      ((value / (1 + st.multAffinity) - st.addWhenTamed) / ((1 + (imprintingBonusRounded + 0.005) * m * imprintingBonusMultiplier) * st.baseValue) - 1) /
        st.incPerWildLevel,
      ((value / (1 + st.multAffinity) - st.addWhenTamed) / ((1 + (imprintingBonusRounded - 0.005) * m * imprintingBonusMultiplier) * st.baseValue) - 1) /
        st.incPerWildLevel,
    );

  const wildLevelsFromImprintedTorpor = wildLevelsFrom(torpor, t, mult[Stat.Torpidity]!);
  wildLevelsFromImprintedTorpor.intersect(0, Number.MAX_SAFE_INTEGER);

  const f = stats[Stat.Food];
  const imprintingBonusFoodFinal = (mult[Stat.Food] ?? 0) * imprintingBonusMultiplier;
  const wildLevelsFromImprintedFood = f && f.incPerWildLevel > 0 ? wildLevelsFrom(food, f, mult[Stat.Food]!) : new IntRange(0, -1);
  wildLevelsFromImprintedFood.intersect(0, Number.MAX_SAFE_INTEGER);

  const imprintingBonusTorpidityFinal = mult[Stat.Torpidity]! * imprintingBonusMultiplier;
  const useFoodForChecking = !!f && imprintingBonusFoodFinal > 0 && wildLevelsFromImprintedFood.valid;

  const wildValue = (stat: number, level: number) => calculateStatValue(species, stat, { wild: level }, { tamed: false });
  const bredValue = (stat: number, level: number, ib: number) =>
    calculateStatValue(species, stat, { wild: level }, { tamed: true, tamingEffectiveness: 1, imprintingBonus: ib });

  const list: { range: Range; support: number }[] = [];
  for (let torporLevel = wildLevelsFromImprintedTorpor.min; torporLevel <= wildLevelsFromImprintedTorpor.max; torporLevel++) {
    let support = 0;
    const range = new Range(
      (((torpor - 0.05) / (1 + t.multAffinity) - t.addWhenTamed) / wildValue(Stat.Torpidity, torporLevel) - 1) / imprintingBonusTorpidityFinal,
      (((torpor + 0.05) / (1 + t.multAffinity) - t.addWhenTamed) / wildValue(Stat.Torpidity, torporLevel) - 1) / imprintingBonusTorpidityFinal,
    );

    if (useFoodForChecking) {
      for (let foodLevel = wildLevelsFromImprintedFood.min; foodLevel <= wildLevelsFromImprintedFood.max; foodLevel++) {
        const fromFood = new Range(
          (((food - 0.05) / (1 + f.multAffinity) - f.addWhenTamed) / wildValue(Stat.Food, foodLevel) - 1) / imprintingBonusFoodFinal,
          (((food + 0.05) / (1 + f.multAffinity) - f.addWhenTamed) / wildValue(Stat.Food, foodLevel) - 1) / imprintingBonusFoodFinal,
        );
        // assumed correct when the food-derived range lies in the torpor-derived one
        if (range.overlaps(fromFood)) {
          const intersection = Range.of(range);
          intersection.intersect(fromFood);
          if (bredValue(Stat.Torpidity, torporLevel, intersection.min) <= torpor && bredValue(Stat.Torpidity, torporLevel, intersection.max) >= torpor) {
            range.intersect(fromFood);
            support++;
          }
        }
      }
    }

    if (
      range.includes(imprintingBonusFromGainPerCuddle) &&
      Math.abs(bredValue(Stat.Torpidity, torporLevel, imprintingBonusFromGainPerCuddle) - torpor) <= 0.5
    ) {
      range.exact = imprintingBonusFromGainPerCuddle;
      support++;
    }
    list.push({ range, support });
  }

  // stable sort, most supported first
  return list
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => b.support - a.support || a.i - b.i)
    .map((x) => x.range);
}
