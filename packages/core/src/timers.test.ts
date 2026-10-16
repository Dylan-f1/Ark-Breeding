import { describe, expect, it } from "vitest";
import { OFFICIAL_SERVER_MULTIPLIERS } from "./species";
import { ASA_SPECIES } from "./species-data";
import { CUDDLE_INTERVAL_S, breedingTimes, nextCuddle, timerDuration } from "./timers";

const rex = ASA_SPECIES.find((s) => s.name === "Rex" && !s.variants?.length)!;
const H = 3600 * 1000;

describe("minuteurs d'élevage", () => {
  it("donne les temps officiels du Rex (œuf)", () => {
    const t = breedingTimes(rex, OFFICIAL_SERVER_MULTIPLIERS)!;
    expect(t.birth.kind).toBe("incubation");
    expect(t.birth.seconds).toBe(rex.breeding!.incubationTime);
    expect(t.maturation).toBe(rex.breeding!.maturationTime);
    expect(t.cuddleInterval).toBe(CUDDLE_INTERVAL_S);
    expect(timerDuration(t, "mating")).toBe(rex.breeding!.matingCooldownMax);
  });

  it("applique les multiplicateurs d'élevage du serveur", () => {
    const fast = { ...OFFICIAL_SERVER_MULTIPLIERS, eggHatchSpeedMultiplier: 10, babyMatureSpeedMultiplier: 20, babyCuddleIntervalMultiplier: 0.5, matingIntervalMultiplier: 0.25 };
    const t = breedingTimes(rex, fast)!;
    expect(t.birth.seconds).toBeCloseTo(rex.breeding!.incubationTime / 10);
    expect(t.maturation).toBeCloseTo(rex.breeding!.maturationTime / 20);
    expect(t.cuddleInterval).toBe(CUDDLE_INTERVAL_S / 2);
    expect(t.matingCooldown[1]).toBeCloseTo(rex.breeding!.matingCooldownMax / 4);
  });

  it("les espèces vivipares ont une gestation", () => {
    const daeodon = ASA_SPECIES.find((s) => s.name === "Daeodon" && !s.variants?.length)!;
    expect(breedingTimes(daeodon, OFFICIAL_SERVER_MULTIPLIERS)!.birth.kind).toBe("gestation");
  });

  it("annonce le prochain câlin, puis plus rien une fois adulte", () => {
    const born = 0;
    const adult = 30 * H;
    expect(nextCuddle(born, adult, 8 * 3600, 1 * H)).toBe(8 * H);
    expect(nextCuddle(born, adult, 8 * 3600, 8 * H)).toBe(8 * H);
    expect(nextCuddle(born, adult, 8 * 3600, 9 * H)).toBe(16 * H);
    expect(nextCuddle(born, adult, 8 * 3600, 25 * H)).toBeNull(); // 32 h would be after adulthood
    expect(nextCuddle(born, adult, 8 * 3600, 31 * H)).toBeNull();
  });
});

describe("durées affichées", () => {
  it("arrondit à la minute sans afficher 60 min", async () => {
    const { formatDuration } = await import("./timers");
    expect(formatDuration(5 * 3600 - 10)).toBe("5 h");
    expect(formatDuration(333_333)).toBe("3 j 20 h 36 min");
    expect(formatDuration(45)).toBe("45 s");
  });
});
