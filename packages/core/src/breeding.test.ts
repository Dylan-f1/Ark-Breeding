import { describe, expect, it } from "vitest";
import { mutationChance, planBreeding, type BreedingCandidate } from "./breeding";
import { bestParentCandidate, buildPedigree, findParentCandidates, pedigreeGenerations, type PedigreeCreature } from "./pedigree";
import { Stat } from "./stats";

const S = [Stat.Health, Stat.Stamina, Stat.Weight, Stat.MeleeDamage];

function dino(id: string, sex: "male" | "female", hp: number, st: number, we: number, me: number, muts = [0, 0]): BreedingCandidate {
  const points = Array(12).fill(0);
  points[Stat.Health] = hp;
  points[Stat.Stamina] = st;
  points[Stat.Weight] = we;
  points[Stat.MeleeDamage] = me;
  return { id, name: id, sex, points, mutationsMother: muts[0]!, mutationsFather: muts[1]! };
}

describe("plan d'élevage (EF-12, EF-13)", () => {
  const line = [
    dino("F1", "female", 40, 30, 20, 35),
    dino("F2", "female", 30, 38, 35, 20),
    dino("F3", "female", 10, 10, 10, 10),
    dino("M1", "male", 25, 25, 38, 40),
    dino("M2", "male", 40, 30, 20, 35),
    dino("M3", "male", 12, 12, 12, 12),
  ];

  it("classe au plus 5 couples par score décroissant", () => {
    const plan = planBreeding(line, S);
    expect(plan.pairs).toHaveLength(5);
    expect(plan.pairs.map((p) => p.score)).toEqual([...plan.pairs.map((p) => p.score)].sort((a, b) => b - a));
    expect(plan.linePoints[Stat.Health]).toBe(40);
  });

  it("met en tête le couple qui réunit les meilleures stats de la lignée", () => {
    const best = planBreeding(line, S).pairs[0]!;
    // F1 × M1: health 40, stamina 30, weight 38, melee 40
    expect([best.motherId, best.fatherId]).toEqual(["F1", "M1"]);
    expect(best.bestPoints[Stat.Weight]).toBe(38);
    expect(best.topStats).toEqual([Stat.Health, Stat.Weight, Stat.MeleeDamage]);
    // 3 of 4 best stats, levels at 94.7 % of the best on average
    expect(best.score).toBeCloseTo((3 / 4 + (1 + 30 / 38 + 1 + 1) / 4) / 2, 10);
  });

  it("calcule la probabilité d'un bébé parfait : 55 % par stat qui diffère", () => {
    const plan = planBreeding(line, S, { limit: 9 });
    const twins = plan.pairs.find((p) => p.motherId === "F1" && p.fatherId === "M2")!;
    expect(twins.perfectChance).toBe(1); // identical parents
    const f1m1 = plan.pairs.find((p) => p.motherId === "F1" && p.fatherId === "M1")!;
    expect(f1m1.perfectChance).toBeCloseTo(0.55 ** 4, 10);
  });

  it("ne mélange pas les sexes, sauf pour les espèces sans sexe", () => {
    expect(planBreeding(line, S, { limit: 100 }).pairs).toHaveLength(9);
    expect(planBreeding(line, S, { limit: 100, noGender: true }).pairs).toHaveLength(15);
  });

  it("chance de mutation : bloquée à 20 mutations par parent", () => {
    const fresh = dino("A", "female", 1, 1, 1, 1);
    const capped = dino("B", "male", 1, 1, 1, 1, [12, 8]);
    expect(mutationChance(fresh, fresh)).toBeCloseTo(1 - 0.975 ** 3, 10);
    expect(mutationChance(fresh, capped)).toBeCloseTo(1 - 0.9875 ** 3, 10);
    expect(mutationChance(capped, capped)).toBe(0);
  });
});

describe("arbre généalogique (EF-14, EF-16)", () => {
  const c = (id: string, extra: Partial<PedigreeCreature> = {}): PedigreeCreature => ({
    id, name: id, arkId: null, motherId: null, fatherId: null, motherArkId: null, fatherArkId: null, motherName: null, fatherName: null, ...extra,
  });

  it("affiche 5 générations en reliant les parents par lien manuel ou par identifiant en jeu", () => {
    const creatures = [
      c("bebe", { motherId: "mere", fatherArkId: "999" }),
      c("mere", { motherId: "grand-mere" }),
      c("pere", { arkId: "999", fatherName: "Grand-père absent" }),
      c("grand-mere", { motherId: "arriere" }),
      c("arriere", { motherId: "arriere2" }),
      c("arriere2", { motherId: "trop-loin" }),
      c("trop-loin"),
    ];
    const rows = pedigreeGenerations(buildPedigree(creatures[0]!, creatures));
    expect(rows.map((r) => r.length)).toEqual([1, 2, 4, 8, 16]);
    expect(rows[1]!.map((n) => n?.name)).toEqual(["mere", "pere"]);
    expect(rows[2]![3]).toMatchObject({ creature: null, name: "Grand-père absent" });
    expect(rows[4]![0]?.name).toBe("arriere2");
    expect(rows.flat().some((n) => n?.name === "trop-loin")).toBe(false);
  });

  it("s'arrête sur une boucle de parenté au lieu de tourner sans fin", () => {
    const creatures = [c("a", { motherId: "b" }), c("b", { motherId: "a" })];
    const rows = pedigreeGenerations(buildPedigree(creatures[0]!, creatures));
    expect(rows[2]![0]?.creature).toBeNull();
  });
});

describe("parents déduits des stats (EF-16)", () => {
  const g = (id: string, sex: "male" | "female", kind: "tamed" | "bred", pts: number[], muts: [number, number] = [0, 0]) => {
    const points = Array(12).fill(0);
    S.forEach((s, i) => (points[s] = pts[i]));
    return { id, sex, kind, points, mutationsMother: muts[0], mutationsFather: muts[1] };
  };
  const mother = g("mere", "female", "tamed", [30, 20, 25, 18]);
  const father = g("pere", "male", "tamed", [22, 35, 25, 40]);
  const other = g("autre", "male", "tamed", [10, 10, 10, 10]);

  it("retrouve le couple quand chaque stat vient d'un parent", () => {
    const baby = g("bebe", "male", "bred", [30, 35, 25, 40]);
    const found = findParentCandidates(baby, [mother, father, other, baby], S);
    expect(found).toMatchObject([{ motherId: "mere", fatherId: "pere", newMutations: 0, mutations: [], countersMatch: true }]);
    expect(bestParentCandidate(found)?.motherId).toBe("mere");
  });

  it("repère une mutation (+2 sur une stat) et le parent dont elle vient", () => {
    const baby = g("bebe", "female", "bred", [32, 35, 25, 40], [1, 0]);
    expect(findParentCandidates(baby, [mother, father, other], S)).toMatchObject([
      {
        motherId: "mere",
        newMutations: 1,
        mutations: [{ stat: Stat.Health, side: "mother", levels: 2 }],
        expectedCounters: { mutationsMother: 1, mutationsFather: 0 },
        countersMatch: true,
      },
    ]);
  });

  it("reconnaît les parents même si l'export laisse les compteurs à 0 (ASA)", () => {
    const baby = g("bebe", "female", "bred", [32, 35, 25, 40], [0, 0]);
    const best = bestParentCandidate(findParentCandidates(baby, [mother, father, other], S));
    expect(best).toMatchObject({ motherId: "mere", fatherId: "pere", countersMatch: false, expectedCounters: { mutationsMother: 1 } });
  });

  it("refuse un couple qui n'explique pas une stat", () => {
    expect(findParentCandidates(g("bebe", "male", "bred", [31, 35, 25, 40]), [mother, father], S)).toEqual([]);
    expect(findParentCandidates(g("bebe", "male", "bred", [30, 35, 25, 48]), [mother, father], S)).toEqual([]); // +8 = 4 mutations
  });

  it("ne choisit pas seul quand deux couples se valent", () => {
    const twin = g("jumeau", "male", "tamed", [22, 35, 25, 40]);
    const found = findParentCandidates(g("bebe", "male", "bred", [30, 35, 25, 40]), [mother, father, twin], S);
    expect(found).toHaveLength(2);
    expect(bestParentCandidate(found)).toBeNull();
  });

  it("ne cherche pas de parents à une créature apprivoisée", () => {
    expect(findParentCandidates(g("x", "male", "tamed", [30, 35, 25, 40]), [mother, father], S)).toEqual([]);
  });

  it("données réelles : Daeodon 5 et 6, mutés, compteurs à 0 dans l'export", () => {
    // Health, Stamina, Oxygen, Food, Weight, Melee as stored in production
    const d = (id: string, sex: "male" | "female", kind: "tamed" | "bred", w: number[]) => {
      const points = Array(12).fill(0);
      [Stat.Health, Stat.Stamina, Stat.Oxygen, Stat.Food, Stat.Weight, Stat.MeleeDamage].forEach((s, i) => (points[s] = w[i]));
      return { id, sex, kind, points, mutationsMother: 0, mutationsFather: 0 };
    };
    const line = [
      d("D1", "male", "tamed", [39, 42, 27, 35, 35, 38]),
      d("D2", "female", "tamed", [29, 35, 36, 32, 42, 34]),
      d("D4", "female", "tamed", [33, 38, 28, 33, 30, 39]),
      d("D3", "female", "tamed", [41, 25, 31, 49, 28, 42]),
    ];
    const stats = [Stat.Health, Stat.Stamina, Stat.Oxygen, Stat.Food, Stat.Weight, Stat.MeleeDamage];
    const d5 = bestParentCandidate(findParentCandidates(d("D5", "male", "bred", [29, 42, 27, 35, 44, 34]), line, stats));
    expect(d5).toMatchObject({ motherId: "D2", fatherId: "D1", mutations: [{ stat: Stat.Weight, side: "mother", levels: 2 }] });
    const d6 = bestParentCandidate(findParentCandidates(d("D6", "female", "bred", [41, 42, 27, 49, 35, 40]), line, stats));
    expect(d6).toMatchObject({ motherId: "D3", fatherId: "D1", mutations: [{ stat: Stat.MeleeDamage, side: "father", levels: 2 }] });
  });
});
