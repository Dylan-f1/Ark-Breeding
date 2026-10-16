import {
  CREATURE_STATUS_LABELS,
  CREATURE_STATUSES,
  STAT_DISPLAY_ORDER,
  STAT_NAMES_FR,
  STAT_SHORT_NAMES_FR,
  Stat,
  colorToHex,
  isPercentageStat,
  type Creature,
  type CreatureStatus,
  MUTATION_LIMIT,
  type PreparedSpecies,
} from "@ark-breeding/core";
import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { MutationInfo } from "~/lib/parents";
import type { SpeciesData } from "~/lib/species";
import { cn } from "~/lib/utils";

const SEX_SYMBOL = { male: "♂", female: "♀", unknown: "–" } as const;
const SEX_TITLE = { male: "Mâle", female: "Femelle", unknown: "Sexe inconnu" } as const;

/** Stats that carry wild levels for this species, in the in-game order. */
export function breedableStats(species: PreparedSpecies): number[] {
  return STAT_DISPLAY_ORDER.filter(
    (s) => s !== Stat.Torpidity && species.canLevelUpWildOrHaveMutations(s) && (species.stats[s]?.incPerWildLevel ?? 0) > 0,
  );
}

/** "M×3" for a stat carrying 3 mutations (stacked over the generations), "M×2 ?" when it is a guess. */
export const stackLabel = (info: MutationInfo, stat: number) =>
  (info.stacks[stat] ?? 0) > 0 ? `M×${info.stacks[stat]}${info.unsure.includes(stat) ? " ?" : ""}` : "";

/** Tooltip of a mutated stat: how many mutations, and the new one if this creature got it. */
export function stackTitle(info: MutationInfo, stat: number) {
  const n = info.stacks[stat] ?? 0;
  if (!n) return "";
  const own = info.mutations.find((m) => m.stat === stat);
  return [
    `${n} mutation${n > 1 ? "s" : ""} sur cette stat`,
    own && `dont ${own.levels / 2} nouvelle${own.levels > 2 ? "s" : ""} côté ${own.side === "mother" ? "mère" : "père"}`,
    info.unsure.includes(stat) && "à confirmer : les deux parents avaient cette valeur",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Wild points inherited by offspring: wild + mutated levels. */
export const wildPoints = (c: Creature, s: number) => Math.max(0, c.levelsWild[s] ?? 0) + Math.max(0, c.levelsMutated[s] ?? 0);

function formatValue(value: number, stat: number) {
  return isPercentageStat(stat) ? `${(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

interface Props {
  species: PreparedSpecies;
  speciesData: SpeciesData;
  creatures: Creature[];
  /** Mutations and counters read from each creature's parents (EF-15, EF-16), by creature id. */
  mutations?: ReadonlyMap<string, MutationInfo>;
  onStatusChange(creature: Creature, status: CreatureStatus): void;
  onDelete(creature: Creature): void;
}

/** Rows shown before "Afficher les N autres": keeps the page light (RSE-01) whatever the library size. */
const PAGE_SIZE = 20;

/** The 6 colour regions as one gradient: a single element per row instead of seven. */
function colorStrip(ids: number[], colorById: Map<number, SpeciesData["colors"][number]>) {
  const hex = ids.map((id) => {
    const c = colorById.get(id);
    return c ? colorToHex(c) : "transparent";
  });
  const stops = hex.map((h, i) => `${h} ${(i * 100) / 6}% ${((i + 1) * 100) / 6}%`).join(", ");
  return {
    background: `linear-gradient(to right, ${stops})`,
    title: ids.map((id) => colorById.get(id)?.name ?? "—").join(" · "),
  };
}

export function SpeciesTable({ species, speciesData, creatures, mutations, onStatusChange, onDelete }: Props) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const stats = breedableStats(species);
  const colorById = new Map(speciesData.colors.map((c) => [c.id, c]));

  // EF-11: best wild points per stat among the living creatures of this line
  const alive = creatures.filter((c) => c.status !== "dead");
  const best = new Map<number, { points: number; holder: Creature }>();
  for (const s of stats)
    for (const c of alive) {
      const p = wildPoints(c, s);
      if (p > 0 && p > (best.get(s)?.points ?? 0)) best.set(s, { points: p, holder: c });
    }
  const shown = creatures.slice(0, limit);

  return (
    <div className="space-y-2">
      {alive.length > 1 && best.size > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">★ Meilleures stats :</span>{" "}
          {stats
            .filter((s) => best.has(s))
            .map((s) => `${STAT_NAMES_FR[s]} ${best.get(s)!.points} (${best.get(s)!.holder.name})`)
            .join(" · ")}
        </p>
      )}
      <Table className="rounded-md border">
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead className="w-8 text-center" aria-label="Sexe" />
            <TableHead className="text-right">Niv.</TableHead>
            {stats.map((s) => (
              <TableHead key={s} className="text-right" title={`${STAT_NAMES_FR[s]} : points sauvages`}>
                {STAT_SHORT_NAMES_FR[s]}
              </TableHead>
            ))}
            <TableHead className="text-right" title="Mutations côté mère / côté père">
              Mut.
            </TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-10" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((c) => {
            const strip = colorStrip(c.colors, colorById);
            return (
              <TableRow key={c.id} className={cn(c.status === "dead" && "opacity-50")}>
                <TableCell>
                  <Link to={`/creature/${c.id}`} className="block font-medium underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                  <span
                    className="mt-1 block h-2 w-16 rounded-full border"
                    style={{ background: strip.background }}
                    title={strip.title}
                    aria-hidden
                  />
                </TableCell>
                <TableCell className="text-center" title={SEX_TITLE[c.sex]} aria-label={SEX_TITLE[c.sex]}>
                  {SEX_SYMBOL[c.sex]}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.level}</TableCell>
                {stats.map((s) => {
                  const points = wildPoints(c, s);
                  const isBest = c.status !== "dead" && best.get(s)?.points === points;
                  const info = mutations?.get(c.id);
                  const stack = info ? stackLabel(info, s) : "";
                  return (
                    <TableCell
                      key={s}
                      className={cn(
                        "text-right tabular-nums whitespace-nowrap",
                        isBest && "bg-primary/15 font-semibold text-primary",
                        stack && !isBest && "font-semibold text-amber-600 dark:text-amber-400",
                      )}
                      title={`${STAT_NAMES_FR[s]} : ${formatValue(c.statValues[s] ?? 0, s)}${(c.levelsDom[s] ?? 0) > 0 ? `, ${c.levelsDom[s]} niveaux domestiques` : ""}${stack ? ` — ${stackTitle(info!, s)}` : ""}${isBest ? " — meilleure valeur de la lignée" : ""}`}
                    >
                      {(c.levelsWild[s] ?? 0) < 0 ? "?" : points}
                      {stack && <sup className="ml-0.5">{stack}</sup>}
                      {isBest && " ★"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <MutationCounters
                    name={c.name}
                    info={mutations?.get(c.id) ?? { mutations: [], mother: c.mutationsMother, father: c.mutationsFather, deduced: false, stacks: [], unsure: [] }}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {CREATURE_STATUS_LABELS[c.status]}
                  {!c.extractionUnique && (
                    <Badge variant="outline" className="ml-1" title="Plusieurs combinaisons de niveaux étaient possibles">
                      À vérifier
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions pour ${c.name}`}>
                        ⋯
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Statut</DropdownMenuLabel>
                      <DropdownMenuRadioGroup value={c.status} onValueChange={(v) => onStatusChange(c, v as CreatureStatus)}>
                        {CREATURE_STATUSES.map((s) => (
                          <DropdownMenuRadioItem key={s} value={s}>
                            {CREATURE_STATUS_LABELS[s]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(c)}>
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {creatures.length > limit && (
        <Button variant="outline" size="sm" onClick={() => setLimit(creatures.length)}>
          Afficher les {creatures.length - limit} autres
        </Button>
      )}
    </div>
  );
}

const sideName = (side: "mother" | "father") => (side === "mother" ? "mère" : "père");

/** EF-15: "mother/father" counters; a click tells what each side holds and which stats mutated. */
function MutationCounters({ name, info }: { name: string; info: MutationInfo }) {
  const capped = info.mother >= MUTATION_LIMIT || info.father >= MUTATION_LIMIT;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded px-1 tabular-nums underline decoration-dotted underline-offset-4 hover:bg-accent",
            info.mutations.length > 0 && "font-semibold text-amber-600 dark:text-amber-400",
            capped && "text-destructive",
          )}
          aria-label={`Mutations de ${name} : ${info.mother} côté mère, ${info.father} côté père`}
        >
          {info.mother}/{info.father}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 text-sm">
        <p className="font-medium">Mutations de {name}</p>
        <ul className="space-y-1">
          {(["mother", "father"] as const).map((side) => {
            const count = info[side];
            const own = info.mutations.filter((m) => m.side === side);
            return (
              <li key={side}>
                Côté {sideName(side)} : <span className="font-semibold tabular-nums">{count}</span>
                {count >= MUTATION_LIMIT && <span className="text-destructive"> (limite atteinte)</span>}
                {own.length > 0 && (
                  <span className="block text-amber-600 dark:text-amber-400">
                    dont nouvelle : {own.map((m) => `+${m.levels} ${STAT_NAMES_FR[m.stat]}`).join(", ")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {info.deduced && (
          <p className="text-xs text-muted-foreground">
            Calculé d'après ses parents : le fichier d'export du jeu indiquait moins de mutations.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
