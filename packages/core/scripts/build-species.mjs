// Builds data/species-asa.json from ARK Smart Breeding (MIT, github.com/cadon/ARKStatsExtractor).
//
// ASB ships ASE values (values.json) plus an ASA override file (ASA-values.json) that lists
// every ASA blueprint and only the properties that differ. ASB merges them in
// Species.LoadOverrides(); this script reproduces that merge and keeps what the site needs.
//
// Usage: node scripts/build-species.mjs [git ref, default "dev"]
import { mkdir, writeFile } from "node:fs/promises";

const ref = process.argv[2] ?? "dev";
const RAW = `https://raw.githubusercontent.com/cadon/ARKStatsExtractor/${ref}`;
const VALUES = `${RAW}/ARKBreedingStats/json/values`;
const outDir = new URL("../data/", import.meta.url);

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

const [base, asa, license] = await Promise.all([
  fetchText(`${VALUES}/values.json`).then(JSON.parse),
  fetchText(`${VALUES}/ASA-values.json`).then(JSON.parse),
  fetchText(`${RAW}/LICENSE`),
]);

// Same fields and conditions as Species.LoadOverrides() in ASB.
function applyOverrides(target, o) {
  const copy = ["name", "nameFemale", "nameMale", "variants", "fullStatsRaw", "altBaseStats",
    "TamedBaseHealthMultiplier", "statImprintMult", "mutationMult", "colors", "taming", "breeding",
    "statNames", "isFlyer", "noGender", "matesWith", "statLevelUpsAdditive", "statCaps"];
  for (const key of copy) if (o[key] != null) target[key] = o[key];
  if (o.displayedStats != null && o.displayedStats !== -1) target.displayedStats = o.displayedStats;
  if (o.skipWildLevelStats) target.skipWildLevelStats = o.skipWildLevelStats;
  return target;
}

const baseByPath = new Map(base.species.map((s) => [s.blueprintPath, s]));

const isDomesticable = (s) =>
  !!(s.taming && (s.taming.nonViolent || s.taming.violent)) ||
  !!(s.breeding && (s.breeding.incubationTime > 0 || s.breeding.gestationTime > 0));

const stripBlueprintSuffix = (bp) => (bp.endsWith("_C") ? bp.slice(0, -2) : bp);

const species = [];
for (const override of asa.species) {
  if (!override.blueprintPath) continue;
  const merged = applyOverrides(structuredClone(baseByPath.get(override.blueprintPath) ?? { blueprintPath: override.blueprintPath }), override);
  if (!merged.name || !merged.fullStatsRaw || !isDomesticable(merged)) continue;

  species.push({
    blueprintPath: merged.blueprintPath,
    name: merged.name,
    ...(merged.nameFemale && { nameFemale: merged.nameFemale }),
    ...(merged.nameMale && { nameMale: merged.nameMale }),
    ...(merged.variants?.length && { variants: merged.variants }),
    fullStatsRaw: merged.fullStatsRaw,
    ...(merged.altBaseStats && { altBaseStats: merged.altBaseStats }),
    ...(merged.displayedStats != null && { displayedStats: merged.displayedStats }),
    skipWildLevelStats: merged.skipWildLevelStats ?? 0,
    ...(merged.TamedBaseHealthMultiplier != null && { tamedBaseHealthMultiplier: merged.TamedBaseHealthMultiplier }),
    ...(merged.statImprintMult && { statImprintMult: merged.statImprintMult }),
    ...(merged.mutationMult && { mutationMult: merged.mutationMult }),
    ...(merged.statLevelUpsAdditive && { statLevelUpsAdditive: merged.statLevelUpsAdditive }),
    ...(merged.statCaps && { statCaps: merged.statCaps }),
    ...(merged.statNames && { statNames: merged.statNames }),
    ...(merged.isFlyer && { isFlyer: true }),
    ...(merged.noGender && { noGender: true }),
    ...(merged.matesWith && { matesWith: merged.matesWith.map(stripBlueprintSuffix) }),
    ...(merged.breeding && { breeding: merged.breeding }),
    ...(merged.colors && { colorRegions: merged.colors.map((c) => c?.name ?? null) }),
  });
}

species.sort((a, b) => a.name.localeCompare(b.name) || a.blueprintPath.localeCompare(b.blueprintPath));

// Colour ids as ASB's ArkColors.InitializeArkColors() assigns them with the ASA values loaded:
// base colours from 1, then the ASA dyes from its dyeStartIndex (128), overriding the ASE dyes.
const colors = new Map();
base.colorDefinitions.forEach(([name, rgba], i) => colors.set(i + 1, { id: i + 1, name, rgba }));
asa.dyeDefinitions.forEach(([name, rgba], i) => {
  const id = asa.dyeStartIndex + i;
  if (id <= 255) colors.set(id, { id, name, rgba, dye: true });
});

await mkdir(outDir, { recursive: true });
await writeFile(
  new URL("species-asa.json", outDir),
  JSON.stringify({
    source: "ARK Smart Breeding (https://github.com/cadon/ARKStatsExtractor), MIT License",
    asbRef: ref,
    baseValuesVersion: base.version,
    asaValuesVersion: asa.version,
    species,
    colors: [...colors.values()].sort((a, b) => a.id - b.id),
  }),
);
await writeFile(new URL("ASB-LICENSE.txt", outDir), license);

console.log(
  `${species.length} ASA species and ${colors.size} colours written (ASA values ${asa.version}, base ${base.version}).`,
);
