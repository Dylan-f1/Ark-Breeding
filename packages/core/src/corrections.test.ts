import { describe, expect, it } from "vitest";
import { correctSpecies } from "./corrections";
import { creatureFromExport, speciesIdFromBlueprint } from "./creature";
import { parseExportFile } from "./export-file";
import { extractCreature } from "./extract-creature";
import { OFFICIAL_SERVER_SETTINGS } from "./server-settings";
import { prepareSpecies, type RawSpecies } from "./species";
import { ASA_SPECIES, findSpeciesById } from "./species-data";
import { calculateStatValue } from "./stat-value";
import { Stat } from "./stats";

/** Writes an export the way the game does. */
function exportFile(opts: { blueprint: string; level: number; values: Record<string, number> }) {
  const lines = [
    ";METADATA=(Diff=true, UseCommands=true)",
    "[Dino Data]",
    "DinoID1=444240064",
    "DinoID2=315747492",
    `DinoClass=${opts.blueprint}`,
    "bIsFemale=False",
    "bNeutered=False",
    "TamerString=Tribu",
    "TamedName=",
    "ImprinterName=",
    "RandomMutationsMale=0",
    "RandomMutationsFemale=0",
    "BabyAge=1",
    `CharacterLevel=${opts.level}`,
    "DinoImprintingQuality=0",
    "",
    "[Colorization]",
    ...[0, 1, 2, 3, 4, 5].map((i) => `ColorSet[${i}]=(R=0.200000,G=0.200000,B=0.200000,A=0.000000)`),
    "",
    "[Max Character Status Values]",
    ...Object.entries(opts.values).map(([k, v]) => `${k}=${v}`),
    "",
    "[Dino Ancestry]",
    "DinoAncestorsCount=0",
    "DinoAncestorsMale=0",
    "",
  ];
  return lines.join("\r\n");
}

// D-40. Two real exports of dinos tamed in the wild (ASA, November 2026, after patch 97).
// Read with the Tek binoculars by the player: health 30, stamina 52, oxygen 39, food 31, weight 28, melee 28.
const DIREWOLF = exportFile({
  blueprint: "/Game/PrimalEarth/Dinos/Direwolf/Direwolf_Character_BP.Direwolf_Character_BP_C",
  level: 209,
  values: {
    Health: 2310.09229,
    stamina: 1612,
    Torpidity: 6066.5,
    Oxygen: 735,
    Food: 4920.14941,
    Water: 100,
    Temperature: 0,
    Weight: 265.200012,
    "Melee Damage": 1.83265471,
    "Movement Speed": 0.300000012,
    Fortitude: 0,
    "Crafting Skill": 0,
  },
});
// Read with the Tek binoculars by the player: health 30, stamina 35, oxygen 31, food 38, weight 30, melee 44.
const THYLACOLEO = exportFile({
  blueprint: "/Game/PrimalEarth/Dinos/Thylacoleo/Thylacoleo_Character_BP.Thylacoleo_Character_BP_C",
  level: 209,
  values: {
    Health: 4900.06982,
    stamina: 1800,
    Torpidity: 9436.5,
    Oxygen: 820,
    Food: 7200.1499,
    Water: 100,
    Temperature: 0,
    Weight: 640,
    "Melee Damage": 2.75703239,
    "Movement Speed": 0.300000012,
    Fortitude: 0,
    "Crafting Skill": 0,
  },
});

const multipliers = OFFICIAL_SERVER_SETTINGS.multipliers;

function extract(text: string, patch?: (values: number[]) => void) {
  const exported = parseExportFile(text)!;
  const species = prepareSpecies(findSpeciesById(speciesIdFromBlueprint(exported.blueprintPath))!, multipliers);
  const statValues = [...exported.statValues];
  patch?.(statValues);
  const result = extractCreature({
    species,
    level: exported.level,
    statValues,
    kind: exported.isBred ? "bred" : "tamed",
    imprintingBonus: exported.imprintingBonus,
    highPrecisionInputs: true,
    maxWildLevel: 150,
  });
  const wild = (s: number) => result.results[s]![result.chosen[s]!]!.levelWild;
  return { exported, result, wild };
}

const raw = (id: string) => findSpeciesById(id)!;
const SIX = [Stat.Health, Stat.Stamina, Stat.Oxygen, Stat.Food, Stat.Weight, Stat.MeleeDamage];

describe("D-40 nourriture : bonus d'apprivoisement fixe depuis le patch 97", () => {
  it("Thylacoleo : retrouve exactement les points lus aux jumelles Tek", () => {
    const { result, wild } = extract(THYLACOLEO);
    expect(result.valid).toBe(true);
    expect(result.unique).toBe(true);
    expect(result.unverifiedStats).toEqual([]);
    expect(SIX.map(wild)).toEqual([30, 35, 31, 38, 30, 44]);
    expect(wild(Stat.Torpidity)).toBe(208);
    expect(result.tamingEffectiveness).toBeGreaterThan(0.99);
  });

  it("loup sinistre : retrouve exactement les points lus aux jumelles Tek, et ils additionnent à la torpeur", () => {
    const { result, wild } = extract(DIREWOLF);
    expect(result.valid).toBe(true);
    expect(result.unique).toBe(true);
    expect(result.unverifiedStats).toEqual([]);
    const levels = SIX.map(wild);
    expect(levels).toEqual([30, 52, 39, 31, 28, 28]);
    expect(levels.reduce((a, b) => a + b, 0)).toBe(wild(Stat.Torpidity));
  });

  it("garde les valeurs d'origine du fichier dans la créature enregistrée", () => {
    const { exported, result } = extract(DIREWOLF);
    const creature = creatureFromExport(exported, result, []);
    expect(creature.statValues).toEqual(exported.statValues);
    expect(creature.levelsWild[Stat.Food]).toBe(31);
  });

  it("Ptéranodon né en élevage du signalement ASB #1422 : le niveau 4 donne la valeur affichée", () => {
    const ptero = prepareSpecies(raw("Ptero_Character_BP"), multipliers);
    // level 27, imprinting 91.66665 %, food shown 1988.2: ASB cannot extract it, no level fits its formula
    const value = calculateStatValue(
      ptero,
      Stat.Food,
      { wild: 4, dom: 0 },
      { tamed: true, tamingEffectiveness: 1, imprintingBonus: 0.9166665, round: false },
    );
    expect(Math.abs(value - 1988.2)).toBeLessThan(0.1);
  });

  it("corrige les espèces dont le bonus de nourriture valait 0,15, et elles seules", () => {
    expect(raw("Direwolf_Character_BP").fullStatsRaw[Stat.Food]!.slice(3)).toEqual([0.15, 0]);
    // never had a food bonus: left alone
    expect(raw("Megatherium_Character_BP").fullStatsRaw[Stat.Food]!.slice(3)).toEqual([0, 0]);
    // no species keeps the old rule
    const stillOld = ASA_SPECIES.filter((s) => s.fullStatsRaw[Stat.Food]?.[4] === 0.15);
    expect(stillOld).toEqual([]);
  });

  it("s'éteint toute seule quand ASB aura corrigé ses valeurs", () => {
    const fixed = raw("Direwolf_Character_BP"); // already Ta = 0.15, Tm = 0
    expect(correctSpecies(fixed)).toBe(fixed);
    // ASB's current values (Ta = 0, Tm = 0.15) are rewritten
    const old: RawSpecies = {
      ...fixed,
      fullStatsRaw: fixed.fullStatsRaw.map((s, i) => (i === Stat.Food ? [1200, 0.1, 0.1, 0, 0.15] : s)),
    };
    expect(correctSpecies(old).fullStatsRaw[Stat.Food]).toEqual([1200, 0.1, 0.1, 0.15, 0]);
    expect(correctSpecies(old)).not.toBe(old);
  });
});

describe("D-40 filet de sécurité : stat d'efficacité qui ne colle pas", () => {
  it("garde la mêlée inconnue mais importe le reste", () => {
    // a melee value below the creature's own base: no level explains it
    const { result, wild } = extract(THYLACOLEO, (values) => {
      values[Stat.MeleeDamage] = 1;
    });
    expect(result.valid).toBe(true);
    expect(result.unverifiedStats).toEqual([Stat.MeleeDamage]);
    expect(wild(Stat.MeleeDamage)).toBe(-1);
    expect([Stat.Health, Stat.Stamina, Stat.Oxygen, Stat.Food, Stat.Weight].map(wild)).toEqual([30, 35, 31, 38, 30]);
  });

  it("refuse toujours un fichier dont une stat sans rapport avec l'efficacité est fausse", () => {
    const { result } = extract(THYLACOLEO, (values) => {
      values[Stat.Oxygen] = 821.4;
    });
    expect(result.valid).toBe(false);
    expect(result.unverifiedStats).toEqual([]);
  });

  it("refuse toujours quand les totaux ne tombent pas juste", () => {
    // 100 more health levels: the known stats alone exceed the 208 levels of the torpidity total
    const { result } = extract(THYLACOLEO, (values) => {
      values[Stat.Health] = 4900.06982 + 700 * 0.2 * 100;
    });
    expect(result.valid).toBe(false);
    expect(result.unverifiedStats).toEqual([]);
  });
});
