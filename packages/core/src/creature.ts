// Creature as stored in a tribe library, shared by apps/api (validation) and apps/web.

import { z } from "zod";
import { closestColorId, type ArkColor } from "./colors";
import type { ExportedCreature } from "./export-file";
import type { ExtractCreatureResult } from "./extract-creature";
import { STATS_COUNT } from "./stats";

/** Short species id: the blueprint class name, e.g. "Rex_Character_BP" (unique in the ASA data). */
export function speciesIdFromBlueprint(blueprintPath: string): string {
  const cls = blueprintPath.split(".").pop() ?? blueprintPath;
  return cls.endsWith("_C") ? cls.slice(0, -2) : cls;
}

export const CREATURE_STATUSES = ["available", "unavailable", "dead"] as const;
export const CREATURE_STATUS_LABELS: Record<(typeof CREATURE_STATUSES)[number], string> = {
  available: "Disponible",
  unavailable: "Indisponible",
  dead: "Mort",
};

export const SEX_LABELS = { male: "Mâle", female: "Femelle", unknown: "Inconnu" } as const;

const statArray = z.array(z.number().int().min(-1).max(10_000)).length(STATS_COUNT);
const arkId = z.string().regex(/^-?\d{1,20}$/).nullable();

export const creatureInputSchema = z.object({
  speciesId: z.string().min(1).max(120),
  name: z.string().trim().max(64),
  sex: z.enum(["male", "female", "unknown"]),
  status: z.enum(CREATURE_STATUSES),
  kind: z.enum(["wild", "tamed", "bred"]),
  level: z.number().int().min(1).max(10_000),
  levelsWild: statArray,
  levelsMutated: statArray,
  levelsDom: statArray,
  statValues: z.array(z.number().finite().min(0).max(1e9)).length(STATS_COUNT),
  tamingEffectiveness: z.number().min(0).max(1).nullable(),
  imprintingBonus: z.number().min(0).max(5),
  mutationsMother: z.number().int().min(0).max(10_000),
  mutationsFather: z.number().int().min(0).max(10_000),
  colors: z.array(z.number().int().min(0).max(255)).length(6),
  neutered: z.boolean(),
  arkId,
  motherArkId: arkId,
  fatherArkId: arkId,
  motherName: z.string().max(64).nullable(),
  fatherName: z.string().max(64).nullable(),
  /** False when the extraction had several possible level combinations. */
  extractionUnique: z.boolean(),
});

export type CreatureInput = z.infer<typeof creatureInputSchema>;
export type CreatureStatus = CreatureInput["status"];

export interface Creature extends CreatureInput {
  id: string;
  tribeId: string;
  createdAt: string;
  updatedAt: string;
}

/** Levels of the chosen extraction results, per stat (-1 = unknown). */
export function chosenLevels(result: ExtractCreatureResult) {
  const pick = (f: "levelWild" | "levelMut" | "levelDom") =>
    result.results.map((r, s) => r[result.chosen[s]!]?.[f] ?? -1);
  return { levelsWild: pick("levelWild"), levelsMutated: pick("levelMut"), levelsDom: pick("levelDom") };
}

/** Builds the library entry from an export file and its extraction. */
export function creatureFromExport(
  exported: ExportedCreature,
  result: ExtractCreatureResult,
  colors: readonly ArkColor[],
): CreatureInput {
  return {
    speciesId: speciesIdFromBlueprint(exported.blueprintPath),
    name: exported.name.slice(0, 64),
    sex: exported.sex,
    status: "available",
    kind: result.kind,
    level: exported.level,
    ...chosenLevels(result),
    statValues: exported.statValues,
    tamingEffectiveness: result.kind === "tamed" && result.tamingEffectiveness >= 0 ? Math.min(1, result.tamingEffectiveness) : null,
    imprintingBonus: result.kind === "bred" ? exported.imprintingBonus : 0,
    mutationsMother: exported.mutationsMother,
    mutationsFather: exported.mutationsFather,
    colors: exported.colorsRgba.map((rgba) => (rgba ? closestColorId(rgba, colors) : 0)),
    neutered: exported.neutered,
    arkId: exported.arkId,
    motherArkId: exported.mother?.arkId || null,
    fatherArkId: exported.father?.arkId || null,
    motherName: exported.mother?.name.slice(0, 64) ?? null,
    fatherName: exported.father?.name.slice(0, 64) ?? null,
    extractionUnique: result.unique,
  };
}

/** Max creatures per save request (an import of a whole DinoExports folder is split). */
export const MAX_CREATURES_PER_SAVE = 100;

export const saveCreaturesSchema = z.object({
  creatures: z.array(creatureInputSchema).min(1).max(MAX_CREATURES_PER_SAVE),
});

export const updateCreatureSchema = z
  .object({ name: creatureInputSchema.shape.name, status: creatureInputSchema.shape.status })
  .partial();

export const tribeNameSchema = z.string().trim().min(3).max(40);

export const createTribeSchema = z.object({ name: tribeNameSchema });
export const renameTribeSchema = z.object({ name: tribeNameSchema });
export const switchTribeSchema = z.object({ tribeId: z.string().uuid() });
export const joinTribeSchema = z.object({ code: z.string().min(10).max(64) });
export const transferTribeSchema = z.object({ userId: z.string().min(1).max(64) });
export const deleteTribeSchema = z.object({ confirmName: z.string() });

/** New levels after the server settings changed (EF-05): only the extraction output is replaced. */
export const recomputeLevelsSchema = z.object({
  creatures: z
    .array(
      creatureInputSchema
        .pick({ levelsWild: true, levelsMutated: true, levelsDom: true, tamingEffectiveness: true, imprintingBonus: true, extractionUnique: true })
        .extend({ id: z.string().uuid() }),
    )
    .min(1)
    .max(MAX_CREATURES_PER_SAVE),
});

export type RecomputeLevelsRequest = z.infer<typeof recomputeLevelsSchema>;
