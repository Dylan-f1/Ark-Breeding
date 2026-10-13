import { describe, expect, it } from "vitest";
import { extractCreature } from "./extract-creature";
import {
  OFFICIAL_SERVER_SETTINGS,
  isOfficialSettings,
  parseServerIni,
  serverSettingsSchema,
  settingsFingerprint,
  tribeSettingsSchema,
} from "./server-settings";
import { prepareSpecies } from "./species";
import { findSpeciesById } from "./species-data";
import { Stat } from "./stats";
import { makeCreature, mulberry32 } from "./test-utils";

const GAME_INI = `
[/script/shootergame.shootergamemode]
; boosted server
PerLevelStatsMultiplier_DinoTamed[0]=0.4
PerLevelStatsMultiplier_DinoTamed_Add[0]=0.2
PerLevelStatsMultiplier_DinoTamed_Affinity[8]=0.5
PerLevelStatsMultiplier_DinoWild[7]=2
BabyImprintingStatScaleMultiplier=2.0
BabyMatureSpeedMultiplier=10
AllowSpeedLeveling=True
`;

describe("réglages serveur", () => {
  it("lit les multiplicateurs d'un Game.ini en gardant les valeurs officielles absentes", () => {
    const { settings, recognized } = parseServerIni(`${GAME_INI}\n[ServerSettings]\nOverrideOfficialDifficulty=6.0`);
    expect(recognized).toHaveLength(8);
    expect(settings.multipliers.statMultipliers[Stat.Health]).toEqual([0.2, 0.44, 0.4, 1]);
    expect(settings.multipliers.statMultipliers[Stat.MeleeDamage]).toEqual([0.14, 0.5, 0.17, 1]);
    expect(settings.multipliers.statMultipliers[Stat.Weight]).toEqual([1, 1, 1, 2]);
    expect(settings.multipliers.statMultipliers[Stat.Stamina]).toBeNull();
    expect(settings.multipliers.babyImprintingStatScaleMultiplier).toBe(2);
    expect(settings.multipliers.allowSpeedLeveling).toBe(true);
    expect(settings.maxWildLevel).toBe(180);
    expect(serverSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it("reconnaît les réglages officiels", () => {
    expect(isOfficialSettings(parseServerIni("").settings)).toBe(true);
    expect(isOfficialSettings(parseServerIni(GAME_INI).settings)).toBe(false);
  });

  it("extrait une créature d'un serveur non officiel avec ses multiplicateurs (EF-05)", () => {
    const { settings } = parseServerIni(GAME_INI);
    const rex = prepareSpecies(findSpeciesById("Rex_Character_BP")!, settings.multipliers);
    const official = prepareSpecies(findSpeciesById("Rex_Character_BP")!, OFFICIAL_SERVER_SETTINGS.multipliers);
    const rand = mulberry32(11);
    let foundWithServer = 0;
    let wrongWithOfficial = 0;
    for (let i = 0; i < 5; i++) {
      const c = makeCreature(rex, "bred", rand, false);
      const input = { level: c.level, statValues: c.values, kind: "bred" as const, imprintingBonus: c.imprintingShown };
      const ok = (r: ReturnType<typeof extractCreature>) =>
        r.valid && r.results.every((res, s) => !rex.stats[s] || c.values[s]! <= 0 || res.some((x) => x.levelDom === c.dom[s]));
      if (ok(extractCreature({ ...input, species: rex }))) foundWithServer++;
      if (!ok(extractCreature({ ...input, species: official }))) wrongWithOfficial++;
    }
    expect(foundWithServer).toBe(5);
    expect(wrongWithOfficial).toBeGreaterThan(0);
  });
});

describe("empreinte des réglages", () => {
  it("ne dépend que des valeurs, pas de l'ordre des clés", () => {
    const a = OFFICIAL_SERVER_SETTINGS;
    const b = JSON.parse(JSON.stringify({ maxWildLevel: a.maxWildLevel, multipliers: a.multipliers }));
    expect(settingsFingerprint(b)).toBe(settingsFingerprint(a));
    expect(settingsFingerprint(parseServerIni(GAME_INI).settings)).not.toBe(settingsFingerprint(a));
  });

  it("accepte un serveur partagé ou des réglages pour une tribu", () => {
    expect(tribeSettingsSchema.safeParse({ serverId: crypto.randomUUID() }).success).toBe(true);
    expect(tribeSettingsSchema.safeParse(OFFICIAL_SERVER_SETTINGS).success).toBe(true);
    expect(tribeSettingsSchema.safeParse({ serverId: "pas-un-uuid" }).success).toBe(false);
  });
});
