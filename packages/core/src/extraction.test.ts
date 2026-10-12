// Round-trip tests: build a creature with known levels, compute the stat values the game would
// show (or export), then check the extractor finds those levels again. This validates the
// inversion against the stat formula; ENF-07 (parity with ASB on real exports) needs the
// reference export files on top of this.

import { describe, expect, it } from "vitest";
import { prepareSpecies } from "./species";
import { ASA_SPECIES, findSpeciesByBlueprint } from "./species-data";
import { calculateStatValue } from "./stat-value";
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
