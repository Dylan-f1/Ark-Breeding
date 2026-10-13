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
  type PreparedSpecies,
} from "@ark-breeding/core";
import { MoreHorizontal } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
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

/** Wild points inherited by offspring: wild + mutated levels. */
export const wildPoints = (c: Creature, s: number) => Math.max(0, c.levelsWild[s] ?? 0) + Math.max(0, c.levelsMutated[s] ?? 0);

function formatValue(value: number, stat: number) {
  return isPercentageStat(stat) ? `${(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

interface Props {
  species: PreparedSpecies;
  speciesData: SpeciesData;
  creatures: Creature[];
  onStatusChange(creature: Creature, status: CreatureStatus): void;
  onDelete(creature: Creature): void;
}

export function SpeciesTable({ species, speciesData, creatures, onStatusChange, onDelete }: Props) {
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

  return (
    <div className="space-y-2">
      {alive.length > 1 && best.size > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Meilleures stats :</span>{" "}
          {stats
            .filter((s) => best.has(s))
            .map((s) => `${STAT_NAMES_FR[s]} ${best.get(s)!.points} (${best.get(s)!.holder.name})`)
            .join(" · ")}
        </p>
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="w-8 text-center">
                <span className="sr-only">Sexe</span>
              </TableHead>
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
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creatures.map((c) => (
              <TableRow key={c.id} className={cn(c.status === "dead" && "opacity-50")}>
                <TableCell>
                  <Link to={`/creature/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                  <div className="mt-1 flex gap-0.5" aria-hidden>
                    {c.colors.map((id, i) => {
                      const color = colorById.get(id);
                      return (
                        <span
                          key={i}
                          className="size-2.5 rounded-full border"
                          style={{ background: color ? colorToHex(color) : "transparent" }}
                          title={color?.name}
                        />
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell className="text-center" title={SEX_TITLE[c.sex]}>
                  {SEX_SYMBOL[c.sex]}
                  <span className="sr-only">{SEX_TITLE[c.sex]}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.level}</TableCell>
                {stats.map((s) => {
                  const points = wildPoints(c, s);
                  const isBest = c.status !== "dead" && best.get(s)?.points === points;
                  return (
                    <TableCell
                      key={s}
                      className={cn("text-right tabular-nums", isBest && "bg-primary/15 font-semibold text-primary")}
                      title={`${STAT_NAMES_FR[s]} : ${formatValue(c.statValues[s] ?? 0, s)}${(c.levelsDom[s] ?? 0) > 0 ? `, ${c.levelsDom[s]} niveaux domestiques` : ""}`}
                    >
                      {(c.levelsWild[s] ?? 0) < 0 ? "?" : points}
                      {isBest && <span className="sr-only"> (meilleure valeur)</span>}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right tabular-nums" title="Mère / père">
                  <span className={cn(c.mutationsMother >= 20 || c.mutationsFather >= 20 ? "text-destructive" : undefined)}>
                    {c.mutationsMother}/{c.mutationsFather}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === "available" ? "secondary" : "outline"}>{CREATURE_STATUS_LABELS[c.status]}</Badge>
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
                        <MoreHorizontal className="size-4" />
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
