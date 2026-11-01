import { createParentResolver, type Creature, type LibraryResponse } from "@ark-breeding/core";
import { loadSpeciesData } from "./species";

/** Version of the file layout, for a future import. */
const FORMAT = "ark-breeding/1";

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

/**
 * EF-21: the whole library of the current tribe as a JSON file (every creature with its levels,
 * values, parents and mutations), plus the server settings it was computed with.
 */
export async function downloadLibrary({ tribe, creatures }: Pick<LibraryResponse, "tribe" | "creatures">) {
  const species = await loadSpeciesData();
  // parents linked by id or by the in-game id of the export
  const resolve = createParentResolver(creatures);
  const data = {
    format: FORMAT,
    exportedAt: new Date().toISOString(),
    tribe: { name: tribe.name, server: tribe.server?.name ?? null, settings: tribe.settings },
    creatures: creatures.map((c: Creature) => ({
      ...c,
      speciesName: species.byId(c.speciesId)?.label ?? c.speciesId,
      motherName: resolve.mother(c)?.name ?? c.motherName,
      fatherName: resolve.father(c)?.name ?? c.fatherName,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ark-breeding-${slug(tribe.name) || "bibliotheque"}-${data.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return creatures.length;
}
