import { buildPedigree, pedigreeGenerations, type Creature } from "@ark-breeding/core";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

const GENERATION_LABELS = ["La créature", "Parents", "Grands-parents", "Arrière-grands-parents", "Arrière-arrière-grands-parents"];
const SEX_SYMBOL = { male: "♂", female: "♀", unknown: "" } as const;

/** EF-14: 5 generations, one column each, mother above father. Each column is a list (screen readers). */
export function PedigreeTree({ creature, creatures }: { creature: Creature; creatures: Creature[] }) {
  const rows = pedigreeGenerations(buildPedigree(creature, creatures, 5), 5);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[56rem] grid-cols-5 gap-3">
        {rows.map((row, g) => (
          <section key={g} aria-label={GENERATION_LABELS[g]} className="flex flex-col">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">{GENERATION_LABELS[g]}</h3>
            <ol className="flex flex-1 flex-col justify-around gap-1">
              {row.map((node, i) => {
                const c = node?.creature;
                const side = g === 0 ? "" : i % 2 === 0 ? "Mère" : "Père";
                return (
                  <li
                    key={i}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs",
                      c ? "bg-card" : "border-dashed text-muted-foreground",
                      c?.id === creature.id && "border-primary",
                    )}
                  >
                    {side && <span className="sr-only">{side} : </span>}
                    {c ? (
                      <Link to={`/creature/${c.id}`} className="block truncate font-medium hover:underline">
                        {SEX_SYMBOL[c.sex]} {c.name}
                        <span className="font-normal text-muted-foreground"> · niv. {c.level}</span>
                      </Link>
                    ) : (
                      <span className="block truncate" title={node?.name ? "Pas dans la bibliothèque" : undefined}>
                        {node?.name ? `${node.name} (absent)` : "Inconnu"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
