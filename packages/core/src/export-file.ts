// Reader for the creature export files the game writes to ShooterGame/Saved/DinoExports
// (port of ASB importExported/ImportExported.cs).

import { STATS_COUNT, isPercentageStat } from "./stats";

export type Sex = "male" | "female" | "unknown";

export interface ExportedParent {
  arkId: string;
  name: string;
}

export interface ExportedCreature {
  /** 64-bit ARK id as a decimal string; null if missing. */
  arkId: string | null;
  blueprintPath: string;
  name: string;
  sex: Sex;
  neutered: boolean;
  tribe: string | null;
  imprinterName: string | null;
  mutationsMother: number;
  mutationsFather: number;
  /** 0..1, 1 = adult. */
  babyAge: number | null;
  level: number;
  /** Exact imprinting, 0..1. */
  imprintingBonus: number;
  /** Six linear RGBA colours, null when not set. */
  colorsRgba: (number[] | null)[];
  /** Full-precision values per stat index; percentage stats as factors (1.25 = 125 %). */
  statValues: number[];
  mother: ExportedParent | null;
  father: ExportedParent | null;
  isBred: boolean;
}

/** ARK concatenates two 32-bit ids for display; the real id is (id1 << 32) | id2. */
function buildArkId(id1: string, id2: string): string | null {
  if (!/^-?\d+$/.test(id1) || !/^-?\d+$/.test(id2)) return null;
  return ((BigInt(id1) << 32n) | (BigInt(id2) & 0xffffffffn)).toString();
}

const ANCESTORS_RE =
  /MaleName=([^;]+) - Lvl \d+;MaleDinoID1=([^;]+);MaleDinoID2=([^;]+);FemaleName=([^;]+) - Lvl \d+;FemaleDinoID1=([^;]+);FemaleDinoID2=([^;]+)/;

function parseColor(text: string): number[] | null {
  const m = text.match(/R=([-\d.]+),G=([-\d.]+),B=([-\d.]+),A=([-\d.]+)/);
  if (!m) return null;
  return m.slice(1, 5).map(Number);
}

/** Returns null when the text is not an ARK creature export. */
export function parseExportFile(text: string): ExportedCreature | null {
  const c: ExportedCreature = {
    arkId: null,
    blueprintPath: "",
    name: "",
    sex: "male",
    neutered: false,
    tribe: null,
    imprinterName: null,
    mutationsMother: 0,
    mutationsFather: 0,
    babyAge: null,
    level: 0,
    imprintingBonus: 0,
    colorsRgba: Array(6).fill(null),
    statValues: Array<number>(STATS_COUNT).fill(0),
    mother: null,
    father: null,
    isBred: false,
  };

  let firstId: string | null = null;
  let firstIdKey: string | null = null;
  let statIndex = -1;
  let inStatSection = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.trimStart().startsWith(";")) continue;
    if (line.includes("[Max Character Status Values]")) {
      inStatSection = true;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq);
    const value = line.slice(eq + 1);
    const num = Number.parseFloat(value);

    // stat lines are read by position: the 12 lines after the section header
    if (inStatSection) {
      statIndex++;
      if (statIndex >= STATS_COUNT) inStatSection = false;
      else {
        c.statValues[statIndex] = (Number.isNaN(num) ? 0 : num) + (isPercentageStat(statIndex) ? 1 : 0);
        continue;
      }
    }

    if (key.includes("DinoAncestorsMale")) {
      // only the last entry holds the direct parents
      const m = value.match(ANCESTORS_RE);
      if (m) {
        c.father = { name: m[1]!, arkId: buildArkId(m[2]!, m[3]!) ?? "" };
        c.mother = { name: m[4]!, arkId: buildArkId(m[5]!, m[6]!) ?? "" };
        c.isBred = true;
      }
      continue;
    }

    const color = key.match(/^ColorSet\[(\d)\]$/);
    if (color) {
      const i = Number(color[1]);
      if (i < 6) c.colorsRgba[i] = parseColor(value);
      continue;
    }

    switch (key) {
      case "DinoID1":
      case "DinoID2":
        if (firstId === null) {
          firstId = value;
          firstIdKey = key;
        } else {
          c.arkId = firstIdKey === "DinoID1" ? buildArkId(firstId, value) : buildArkId(value, firstId);
        }
        break;
      case "DinoClass":
        // despite its name, the full blueprint path
        c.blueprintPath = value;
        break;
      case "bIsFemale":
        c.sex = value === "True" ? "female" : "male";
        break;
      case "bNeutered":
        c.neutered = value !== "False";
        break;
      case "TamerString":
        c.tribe = value || null;
        break;
      case "TamedName":
        c.name = value;
        break;
      case "ImprinterName":
        c.imprinterName = value || null;
        if (value.trim()) c.isBred = true;
        break;
      case "RandomMutationsMale":
        c.mutationsFather = Math.trunc(num) || 0;
        break;
      case "RandomMutationsFemale":
        c.mutationsMother = Math.trunc(num) || 0;
        break;
      case "BabyAge":
        c.babyAge = Number.isNaN(num) ? null : num;
        if (c.babyAge !== null && c.babyAge < 1) c.isBred = true;
        break;
      case "CharacterLevel":
        c.level = Math.trunc(num) || 0;
        break;
      case "DinoImprintingQuality":
        c.imprintingBonus = Number.isNaN(num) ? 0 : num;
        if (num > 0) c.isBred = true;
        break;
    }
  }

  return c.blueprintPath ? c : null;
}
