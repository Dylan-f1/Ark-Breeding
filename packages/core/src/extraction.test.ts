// Round-trip tests: build a creature with known levels, compute the stat values the game would
// show (or export), then check the extractor finds those levels again. This validates the
// inversion against the stat formula; ENF-07 (parity with ASB on real exports) needs the
// reference export files on top of this.

import { describe, expect, it } from "vitest";
import { prepareSpecies } from "./species";
import { ASA_SPECIES, findSpeciesByBlueprint } from "./species-data";
import { calculateStatValue } from "./stat-value";
import { ambiguousStats, extractCreature, keepLevels, pickResult, resetChoices, statChoices } from "./extract-creature";
import { check, makeCreature, mulberry32 } from "./test-utils";
import { Stat } from "./stats";

// The Troodonism bug (alternative base stats) is not ported yet.
const testedSpecies = ASA_SPECIES.filter((s) => !s.altBaseStats).map((s) => prepareSpecies(s));
// species without breeding data cannot be raised
const canBeBred = (sp: (typeof testedSpecies)[number]) => !!sp.raw.breeding && sp.raw.breeding.maturationTime > 0;

describe.each([
  ["valeurs affichées en jeu", false],
  ["fichiers d'export", true],
] as const)("extraction aller-retour — %s", (_label, highPrecision) => {
  it.each(["wild", "tamed", "bred"] as const)("retrouve les niveaux d'une créature %s pour chaque espèce", (kind) => {
    const rand = mulberry32(highPrecision ? 7 : 42);
    const failures: string[] = [];
    let total = 0;
    for (const sp of testedSpecies) {
      if (kind === "bred" && !canBeBred(sp)) continue;
      for (let i = 0; i < 3; i++) {
        const c = makeCreature(sp, kind, rand, highPrecision);
        // a tamed creature with 0 health cannot exist (e.g. negative taming bonus of some mission bosses)
        if (kind !== "wild" && c.values[Stat.Health]! <= 0) continue;
        total++;
        const error = check(sp, c, highPrecision);
        if (error) failures.push(`${sp.name} (${sp.raw.blueprintPath.split("/").pop()}) lvl ${c.level}: ${error}`);
      }
    }
    expect(total).toBeGreaterThan(900);
    expect(failures.slice(0, 15)).toEqual([]);
  });
});

describe("données d'espèces", () => {
  it("contient les espèces principales d'ASA", () => {
    for (const bp of [
      "/Game/PrimalEarth/Dinos/Rex/Rex_Character_BP.Rex_Character_BP",
      "/Game/PrimalEarth/Dinos/Argentavis/Argent_Character_BP.Argent_Character_BP",
    ])
      expect(findSpeciesByBlueprint(bp)?.name).toBeTruthy();
  });

  it("calcule la vie d'un Rex sauvage niveau 1 (1100 PV)", () => {
    const rex = prepareSpecies(findSpeciesByBlueprint("/Game/PrimalEarth/Dinos/Rex/Rex_Character_BP.Rex_Character_BP_C")!);
    expect(calculateStatValue(rex, Stat.Health, { wild: 0 }, { tamed: false })).toBe(1100);
  });
});

describe("valeur erronée", () => {
  it("désigne la stat fausse plutôt que toutes les stats", () => {
    const rex = prepareSpecies(findSpeciesByBlueprint("/Game/PrimalEarth/Dinos/Rex/Rex_Character_BP.Rex_Character_BP")!);
    const c = makeCreature(rex, "bred", mulberry32(3), false);
    const values = [...c.values];
    values[Stat.Weight] = 1; // typo
    const r = extractCreature({ species: rex, level: c.level, statValues: values, kind: "bred", imprintingBonus: c.imprintingShown });
    expect(r.valid).toBe(false);
    expect(r.failedStats).toEqual([Stat.Weight]);
  });
});

describe("EF-09 choisir parmi plusieurs extractions", () => {
  const argentavis = prepareSpecies(ASA_SPECIES.find((s) => s.name === "Argentavis" && !s.variants?.length && s.blueprintPath.includes("PrimalEarth"))!);
  // first ambiguous tamed Argentavis of a fixed series
  const rand = mulberry32(3);
  let c = makeCreature(argentavis, "tamed", rand, false);
  let r = extractCreature({ species: argentavis, level: c.level, statValues: c.values, kind: "tamed" });
  while (!(r.valid && !r.unique)) {
    c = makeCreature(argentavis, "tamed", rand, false);
    r = extractCreature({ species: argentavis, level: c.level, statValues: c.values, kind: "tamed" });
  }
  const truth = (res: typeof r, s: number) => res.results[s]!.findIndex((x) => x.levelWild === c.wild[s] && x.levelDom === c.dom[s]);

  it("retrouve les vrais niveaux quand le joueur choisit stat par stat", () => {
    let res = r;
    const stats = ambiguousStats(res);
    expect(stats.length).toBeGreaterThan(0);
    for (const s of stats) {
      expect(statChoices(res, s).some((x) => x.index === truth(res, s))).toBe(true);
      res = pickResult(res, s, truth(res, s));
    }
    expect(res.unique).toBe(true);
    for (const s of stats) expect(res.chosen[s]).toBe(truth(res, s));
  });

  it("un choix écarte les possibilités des autres stats qui ne tombent plus juste", () => {
    const fresh = extractCreature({ species: argentavis, level: c.level, statValues: c.values, kind: "tamed" });
    const [first, ...others] = ambiguousStats(fresh);
    const before = others.reduce((n, s) => n + statChoices(fresh, s).length, 0);
    const picked = pickResult(fresh, first!, truth(fresh, first!));
    const after = others.reduce((n, s) => n + statChoices(picked, s).length, 0);
    expect(after).toBeLessThanOrEqual(before);
    expect(resetChoices(picked).unique).toBe(false);
  });

  it("garde le choix du joueur lors d'un nouveau calcul, s'il reste possible", () => {
    const again = extractCreature({ species: argentavis, level: c.level, statValues: c.values, kind: "tamed" });
    const kept = keepLevels(again, c.wild, c.dom)!;
    expect(kept.unique).toBe(true);
    expect(kept.chosen.map((i, s) => kept.results[s]![i]?.levelWild ?? 0).filter((_, s) => s !== Stat.Torpidity)).toEqual(
      c.wild.filter((_, s) => s !== Stat.Torpidity),
    );
    const impossible = c.wild.map((w, s) => (s === ambiguousStats(again)[0] ? w + 1000 : w));
    expect(keepLevels(extractCreature({ species: argentavis, level: c.level, statValues: c.values, kind: "tamed" }), impossible, c.dom)).toBeNull();
  });
});
