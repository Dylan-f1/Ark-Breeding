import {
  STAT_DISPLAY_ORDER,
  STAT_NAMES_FR,
  STAT_SHORT_NAMES_FR,
  Stat,
  isPercentageStat,
  type Creature,
  LEVELS_PER_MUTATION,
  MUTATION_LIMIT,
  type PreparedSpecies,
} from "@ark-breeding/core";
import { useState } from "react";
import { Link } from "react-router";
import { regionColors, type RegionColor } from "~/components/colors/regions";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

/** Mutated levels of a stat: found from the parents (D-24) or saved on the creature (D-26). */
export const mutatedLevelsOf = (c: Creature, s: number, info?: MutationInfo) =>
  Math.max((info?.stacks[s] ?? 0) * LEVELS_PER_MUTATION, Math.max(0, c.levelsMutated[s] ?? 0));

/** Wild points inherited by offspring: wild + mutated levels. */
export const wildPoints = (c: Creature, s: number) => Math.max(0, c.levelsWild[s] ?? 0) + Math.max(0, c.levelsMutated[s] ?? 0);

function formatValue(value: number, stat: number) {
  return isPercentageStat(stat) ? `${(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** The schema accepts an empty name (an unnamed export): it still needs something to click. */
export const nameOf = (c: Creature) => c.name.trim() || "Sans nom";

interface Props {
  /** analyseLine() of these creatures: the library also shows its answer in the species head. */
  line: LineAnalysis;
  speciesData: SpeciesData;
  creatures: Creature[];
  /** Mutations and counters read from each creature's parents (EF-15, EF-16), by creature id. */
  mutations?: ReadonlyMap<string, MutationInfo>;
  /** D-26: creatures ticked for a deletion. */
  selected?: ReadonlySet<string>;
  onSelect?(ids: string[], on: boolean): void;
  onRename(creature: Creature): void;
  onDelete(creature: Creature): void;
}

/** Rows shown before "Afficher les N autres": keeps the page light (RSE-01) whatever the library size. */
const PAGE_SIZE = 20;

type Mark = "clean" | "mutated" | null;
export type Rank = "perfect" | "closest" | null;

/**
 * EF-11 / D-28 / D-31: best points per stat in a line, twice: among the stats without any mutation
 * (the "perfect" clean creature) and, when higher, with mutations; then how close each creature is
 * to the perfect one. Creatures no longer useful are deleted, not kept with a status (D-30).
 */
export function analyseLine(species: PreparedSpecies, creatures: Creature[], mutations?: ReadonlyMap<string, MutationInfo>) {
  const stats = breedableStats(species);
  const known = (c: Creature, s: number) => (c.levelsWild[s] ?? 0) >= 0;
  const mutated = (c: Creature, s: number) => mutatedLevelsOf(c, s, mutations?.get(c.id));
  const best = new Map<number, number>();
  const bestMutated = new Map<number, number>();
  for (const s of stats)
    for (const c of creatures) {
      if (!known(c, s)) continue;
      const p = wildPoints(c, s);
      const target = mutated(c, s) > 0 ? bestMutated : best;
      if (p > 0 && p > (target.get(s) ?? 0)) target.set(s, p);
    }
  // a mutated stat only counts when it beats the clean one
  for (const [s, p] of bestMutated) if (p <= (best.get(s) ?? 0)) bestMutated.delete(s);

  // D-35: one creature alone is the best of nothing
  const markOf = (c: Creature, s: number): Mark => {
    if (creatures.length < 2 || !known(c, s)) return null;
    const p = wildPoints(c, s);
    if (mutated(c, s) > 0) return bestMutated.get(s) === p ? "mutated" : null;
    return best.get(s) === p ? "clean" : null;
  };
  const holders = (s: number, kind: "clean" | "mutated") => creatures.filter((c) => markOf(c, s) === kind);
  // D-35: a best value most of the line shares tells nothing: no tint, the green figure stays
  const crowded = new Set(stats.filter((s) => holders(s, "clean").length > creatures.length / 2));

  const stars = new Map(creatures.map((c) => [c.id, stats.filter((s) => markOf(c, s)).length]));
  const top = Math.max(0, ...stars.values());
  const rankOf = (c: Creature): Rank => {
    const n = stars.get(c.id) ?? 0;
    if (creatures.length < 2 || n === 0) return null;
    if (n === stats.length) return "perfect";
    return n === top ? "closest" : null;
  };
  // the answer of the page first: the perfect ones, then the closest, then the rest as imported
  const order = (c: Creature) => ({ perfect: 0, closest: 1, none: 2 })[rankOf(c) ?? "none"];
  const sorted = [...creatures].sort((a, b) => order(a) - order(b));

  const list = (m: Map<number, number>, kind: "clean" | "mutated") =>
    stats.filter((s) => m.has(s)).map((s) => ({ stat: s, points: m.get(s)!, holders: holders(s, kind) }));
  return {
    stats,
    sorted,
    markOf,
    rankOf,
    stars,
    crowded,
    ranked: sorted.filter((c) => rankOf(c)),
    best: creatures.length < 2 ? [] : list(best, "clean"),
    bestMutated: creatures.length < 2 ? [] : list(bestMutated, "mutated"),
  };
}

export type LineAnalysis = ReturnType<typeof analyseLine>;

export function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("size-[0.95em] shrink-0 fill-current", className)} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
    </svg>
  );
}

/** D-31, at the top of the line: the dino to breed from, without reading the table. */
export function ClosestToPerfect({ line }: { line: LineAnalysis }) {
  const first = line.ranked[0];
  if (!first) return null;
  const perfect = line.rankOf(first) === "perfect";
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-gold">
      <StarIcon className="size-4" />
      {perfect ? "Parfait :" : "Plus proche du parfait :"}{" "}
      <a
        href={`#dino-${first.id}`}
        className="font-semibold text-foreground underline decoration-gold/60 underline-offset-3"
      >
        {nameOf(first)}
      </a>
      {!perfect && (
        <span className="font-semibold tabular-nums">
          {line.stars.get(first.id)}/{line.stats.length}
        </span>
      )}
      {line.ranked.length > 1 && <span className="text-sm text-muted-foreground">et {plural(line.ranked.length - 1, "autre")}</span>}
    </p>
  );
}

function BestList({ title, items, kind }: { title: string; items: LineAnalysis["best"]; kind: "clean" | "mutated" }) {
  return (
    <div>
      <p className={cn("font-semibold", kind === "clean" ? "text-clean" : "text-mut")}>{title}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-0.5">
        {items.map((b) => (
          <li key={b.stat}>
            {STAT_NAMES_FR[b.stat]} <b className="tabular-nums">{b.points}</b>{" "}
            {b.holders.length === 1 ? (
              <a
                href={`#dino-${b.holders[0]!.id}`}
                title={nameOf(b.holders[0]!)}
                className="inline-block max-w-[14rem] truncate align-bottom text-muted-foreground underline-offset-3 hover:text-foreground hover:underline"
              >
                {nameOf(b.holders[0]!)}
              </a>
            ) : (
              <span className="text-muted-foreground" title={b.holders.map(nameOf).join(", ")}>
                {plural(b.holders.length, "dino")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const regionLabel = (r: RegionColor) => `Région ${r.index} (${r.name}) : ${r.color ? `${r.color.name}, n° ${r.color.id}` : "aucune couleur"}`;

/** D-35: the regions the species uses, one chip each; the outline keeps dark colours visible. */
function ColorChips({ regions }: { regions: RegionColor[] }) {
  if (!regions.length) return null;
  return (
    <span className="flex justify-end gap-[3px]" role="img" aria-label={`Couleurs : ${regions.map(regionLabel).join(", ")}`}>
      {regions.map((r) => (
        <span
          key={r.index}
          className="block size-[1.05rem] rounded-[2px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.3)]"
          style={{ background: r.hex }}
          title={regionLabel(r)}
        />
      ))}
    </span>
  );
}

// sticky check and name columns: opaque, they hide what scrolls under them
const STICKY = "sticky z-10 bg-card group-hover:bg-accent group-data-[state=selected]:bg-accent group-target:bg-panel-2";

export function SpeciesTable({ line, speciesData, creatures, mutations, selected, onSelect, onRename, onDelete }: Props) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { stats } = line;
  const colorById = new Map(speciesData.colors.map((c) => [c.id, c]));
  const regionNames = creatures[0] ? speciesData.byId(creatures[0].speciesId)?.raw.colorRegions : undefined;
  const shown = line.sorted.slice(0, limit);

  return (
    <div className="space-y-3">
      {(line.best.length > 0 || line.bestMutated.length > 0) && (
        <div className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
          {line.best.length > 0 && <BestList title="Meilleures sans mutation" items={line.best} kind="clean" />}
          {line.bestMutated.length > 0 && <BestList title="Avec mutation" items={line.bestMutated} kind="mutated" />}
        </div>
      )}
      <Table className="text-[0.92rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {onSelect && (
              <TableHead className={cn(STICKY, "left-0 w-9 min-w-9")}>
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label="Tout sélectionner"
                  checked={shown.length > 0 && shown.every((c) => selected?.has(c.id))}
                  onChange={(e) => onSelect(shown.map((c) => c.id), e.target.checked)}
                />
              </TableHead>
            )}
            <TableHead className={cn(STICKY, onSelect ? "left-9" : "left-0", "min-w-28 shadow-[1px_0_0_var(--border)]")}>Nom</TableHead>
            <TableHead className="w-8 text-center" aria-label="Sexe" />
            <TableHead className="text-right">Niv.</TableHead>
            {stats.map((s) => (
              <TableHead key={s} className="text-right" title={`${STAT_NAMES_FR[s]} : points sauvages`}>
                <span aria-hidden>{STAT_SHORT_NAMES_FR[s]}</span>
                <span className="sr-only">{STAT_NAMES_FR[s]}</span>
              </TableHead>
            ))}
            <TableHead className="text-right" title="Mutations côté mère / côté père">
              <span aria-hidden>Mut.</span>
              <span className="sr-only">Mutations côté mère et côté père</span>
            </TableHead>
            <TableHead className="text-right">Couleurs</TableHead>
            <TableHead className="w-10" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((c) => {
            const rank = line.rankOf(c);
            const info = mutations?.get(c.id) ?? { mutations: [], mother: c.mutationsMother, father: c.mutationsFather, deduced: false, stacks: [], unsure: [], colorRegions: [] };
            return (
              <TableRow
                key={c.id}
                id={`dino-${c.id}`}
                className="group hover:bg-accent data-[state=selected]:bg-accent target:bg-panel-2"
                data-state={selected?.has(c.id) ? "selected" : undefined}
              >
                {onSelect && (
                  <TableCell className={cn(STICKY, "left-0")}>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label={`Sélectionner ${nameOf(c)}, ${SEX_TITLE[c.sex].toLowerCase()}, niveau ${c.level}`}
                      checked={!!selected?.has(c.id)}
                      onChange={(e) => onSelect([c.id], e.target.checked)}
                    />
                  </TableCell>
                )}
                {/* row header: moving along a row tells which dino it is, even among 10 "Megatherium" */}
                <th scope="row" className={cn(STICKY, onSelect ? "left-9" : "left-0", "max-w-40 p-2 text-left align-middle font-normal whitespace-normal shadow-[1px_0_0_var(--border)] sm:max-w-72")}>
                  <span className="flex flex-wrap items-center gap-x-1.5">
                    <Link
                      to={`/creature/${c.id}`}
                      className={cn("font-semibold [overflow-wrap:anywhere] underline-offset-2 hover:underline", !c.name.trim() && "text-muted-foreground italic")}
                    >
                      {nameOf(c)}
                    </Link>
                    {rank && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 text-xs font-semibold text-gold",
                          rank === "perfect" && "rounded-sm bg-gold/15 px-1.5 py-0.5",
                        )}
                        title={
                          rank === "perfect"
                            ? `Parfait : les ${stats.length} meilleures stats de la lignée`
                            : `Le plus proche du parfait : ${line.stars.get(c.id)} meilleures stats de la lignée sur ${stats.length}`
                        }
                      >
                        <StarIcon />
                        <span aria-hidden>{rank === "perfect" ? "Parfait" : `${line.stars.get(c.id)}/${stats.length}`}</span>
                        <span className="sr-only">
                          {rank === "perfect" ? "Parfait" : `Le plus proche du parfait, ${line.stars.get(c.id)} meilleures stats sur ${stats.length}`}
                        </span>
                      </span>
                    )}
                  </span>
                  {!c.extractionUnique && (
                    <Badge variant="outline" className="mt-1" title="Plusieurs combinaisons de niveaux étaient possibles">
                      À vérifier
                    </Badge>
                  )}
                </th>
                <TableCell className="text-center" title={SEX_TITLE[c.sex]} aria-label={SEX_TITLE[c.sex]}>
                  {SEX_SYMBOL[c.sex]}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{c.level}</TableCell>
                {stats.map((s) => {
                  const points = wildPoints(c, s);
                  // green: best clean stat; amber: best stat thanks to mutations
                  const mark = line.markOf(c, s);
                  const stack = stackLabel(info, s);
                  return (
                    <TableCell
                      key={s}
                      className={cn(
                        "text-right tabular-nums whitespace-nowrap",
                        mark === "clean" && "font-bold text-clean",
                        mark === "clean" && !line.crowded.has(s) && "bg-clean/15",
                        mark === "mutated" && "bg-mut/15 font-semibold text-mut",
                        stack && !mark && "font-semibold text-mut",
                      )}
                      title={`${STAT_NAMES_FR[s]} : ${formatValue(c.statValues[s] ?? 0, s)}${(c.levelsDom[s] ?? 0) > 0 ? `, ${c.levelsDom[s]} niveaux domestiques` : ""}${stack ? ` — ${stackTitle(info, s)}` : ""}${mark === "clean" ? " — meilleure valeur sans mutation de la lignée" : ""}${mark === "mutated" ? " — meilleure valeur avec mutation de la lignée" : ""}`}
                    >
                      {(c.levelsWild[s] ?? 0) < 0 ? "?" : points}
                      {stack && <sup className="ml-0.5">{stack}</sup>}
                      {mark && <span className="sr-only">{mark === "clean" ? " (meilleure sans mutation)" : " (meilleure avec mutation)"}</span>}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <MutationCounters name={nameOf(c)} info={info} />
                </TableCell>
                <TableCell className="text-right">
                  <ColorChips regions={regionColors(c.colors, regionNames, colorById)} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions pour ${nameOf(c)}`}>
                        ⋯
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onRename(c)}>Renommer</DropdownMenuItem>
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
            info.mutations.length > 0 && "font-semibold text-mut",
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
                  <span className="block text-mut">
                    dont nouvelle : {own.map((m) => `+${m.levels} ${STAT_NAMES_FR[m.stat]}`).join(", ")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {info.colorRegions.length > 0 && (
          <p className="text-mut">
            Couleur mutée : région{info.colorRegions.length > 1 ? "s" : ""} {info.colorRegions.join(", ")}
          </p>
        )}
        {info.deduced && (
          <p className="text-xs text-muted-foreground">
            Calculé d'après ses parents : le fichier d'export du jeu indiquait moins de mutations.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
