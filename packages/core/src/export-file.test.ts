import { describe, expect, it } from "vitest";
import { colorToHex } from "./colors";
import { creatureFromExport, speciesIdFromBlueprint } from "./creature";
import { parseExportFile } from "./export-file";
import { extractCreature } from "./extract-creature";
import { prepareSpecies } from "./species";
import { ASA_COLORS, findSpeciesByBlueprint } from "./species-data";
import { Stat, isPercentageStat } from "./stats";
import { makeCreature, mulberry32 } from "./test-utils";

const REX_BP = "/Game/PrimalEarth/Dinos/Rex/Rex_Character_BP.Rex_Character_BP_C";
const STAT_KEYS = ["Health", "Stamina", "Torpidity", "Oxygen", "food", "Water", "Temperature", "Weight", "Melee Damage", "Movement Speed", "Fortitude", "Crafting Skill"];

/** Writes an export file the way the game does (stat values as floats, percentages minus 1). */
function writeExport(opts: { values: number[]; level: number; imprinting: number; female: boolean; colors: number[][]; withParents: boolean }) {
  const f = (v: number) => Math.fround(v).toFixed(6);
  return [
    "[Dino Data]",
    "DinoID1=123456789",
    "DinoID2=987654321",
    `DinoClass=${REX_BP}`,
    "DinoNameTag=Rex",
    `bIsFemale=${opts.female ? "True" : "False"}`,
    "bNeutered=False",
    "TamerString=Tribu des Tests",
    "TamedName=Rexou",
    `ImprinterName=${opts.imprinting > 0 ? "Dylan" : ""}`,
    "RandomMutationsMale=3",
    "RandomMutationsFemale=5",
    "BabyAge=1.000000",
    `CharacterLevel=${opts.level}`,
    `DinoImprintingQuality=${f(opts.imprinting)}`,
    "[Colorization]",
    ...opts.colors.map((c, i) => `ColorSet[${i}]=(R=${f(c[0]!)},G=${f(c[1]!)},B=${f(c[2]!)},A=${f(c[3]!)})`),
    "[Max Character Status Values]",
    ...opts.values.map((v, s) => `${STAT_KEYS[s]}=${f(isPercentageStat(s) ? v - 1 : v)}`),
    ...(opts.withParents
      ? [
          "[Dino Ancestry]",
          "DinoAncestorsMale0=MaleName=Papa - Lvl 150;MaleDinoID1=11;MaleDinoID2=22;FemaleName=Maman - Lvl 148;FemaleDinoID1=33;FemaleDinoID2=44;",
        ]
      : []),
    "",
  ].join("\r\n");
}

describe("fichier d'export", () => {
  const rex = prepareSpecies(findSpeciesByBlueprint(REX_BP)!);
  const red = ASA_COLORS.find((c) => c.name === "Dino Dark Red")!;

  it("relit un export et retrouve les niveaux d'un Rex élevé", () => {
    const rand = mulberry32(5);
    for (let i = 0; i < 30; i++) {
      const c = makeCreature(rex, "bred", rand, true);
      const text = writeExport({
        values: c.values,
        level: c.level,
        imprinting: c.imprinting,
        female: true,
        colors: Array.from({ length: 6 }, () => red.rgba),
        withParents: true,
      });
      const exported = parseExportFile(text)!;
      expect(exported.level).toBe(c.level);

      const result = extractCreature({
        species: rex,
        level: exported.level,
        statValues: exported.statValues,
        kind: exported.isBred ? "bred" : "tamed",
        imprintingBonus: exported.imprintingBonus,
        highPrecisionInputs: true,
      });
      expect(result.valid).toBe(true);
      for (const s of [Stat.Health, Stat.Stamina, Stat.Weight, Stat.MeleeDamage])
        expect(result.results[s]!.some((r) => r.levelWild === c.wild[s] && r.levelDom === c.dom[s])).toBe(true);
    }
  });

  it("lit l'identité, les mutations, les couleurs et les parents", () => {
    const c = makeCreature(rex, "bred", mulberry32(9), true);
    const exported = parseExportFile(
      writeExport({ values: c.values, level: c.level, imprinting: 0.5, female: false, colors: Array.from({ length: 6 }, () => red.rgba), withParents: true }),
    )!;
    const result = extractCreature({ species: rex, level: exported.level, statValues: exported.statValues, kind: "bred", imprintingBonus: exported.imprintingBonus, highPrecisionInputs: true });
    const creature = creatureFromExport(exported, result, ASA_COLORS);

    expect(creature).toMatchObject({
      speciesId: "Rex_Character_BP",
      name: "Rexou",
      sex: "male",
      kind: "bred",
      mutationsFather: 3,
      mutationsMother: 5,
      arkId: ((123456789n << 32n) | 987654321n).toString(),
      fatherName: "Papa",
      motherName: "Maman",
      fatherArkId: ((11n << 32n) | 22n).toString(),
      motherArkId: ((33n << 32n) | 44n).toString(),
    });
    expect(creature.colors).toEqual(Array(6).fill(red.id));
    expect(colorToHex(red)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("refuse un fichier qui n'est pas un export", () => {
    expect(parseExportFile("[Something]\nfoo=bar")).toBeNull();
  });

  it("identifie l'espèce par le nom de classe", () => {
    expect(speciesIdFromBlueprint(REX_BP)).toBe("Rex_Character_BP");
  });
});
