import {
  STAT_NAMES_FR,
  ambiguousStats,
  pickResult,
  resetChoices,
  statChoices,
  type ExtractCreatureResult,
} from "@ark-breeding/core";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

const describe = (r: { levelWild: number; levelMut: number; levelDom: number }) =>
  `Sauvage ${r.levelWild}${r.levelMut > 0 ? ` + ${r.levelMut} mutés` : ""} · Domestique ${r.levelDom}`;

/**
 * EF-09: several level splits fit the values shown in game. The player picks the right one per
 * stat (in game: the wild levels are on the creature's taming notes, or known from the parents);
 * each pick drops what no longer adds up on the other stats.
 */
export function ExtractionChoices({
  result,
  picked,
  onPick,
  onReset,
}: {
  result: ExtractCreatureResult;
  /** Stats the player already picked. */
  picked: ReadonlySet<number>;
  onPick(stat: number, index: number): void;
  onReset(): void;
}) {
  const stats = ambiguousStats(result);
  if (!stats.length) return null;
  return (
    <fieldset className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
      <legend className="px-1 text-sm font-medium">Plusieurs répartitions possibles</legend>
      <p className="text-sm text-muted-foreground">
        Les valeurs collent avec plusieurs répartitions des niveaux. La plus probable est choisie ; corrige-la si tu
        connais les niveaux sauvages (ou ceux des parents).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {stats.map((s) => {
          const choices = statChoices(result, s);
          return (
            <div key={s} className="space-y-1">
              <Label htmlFor={`choix-${s}`}>
                {STAT_NAMES_FR[s]}{" "}
                <span className="font-normal text-muted-foreground">
                  ({choices.length} possibilité{choices.length > 1 ? "s" : ""}
                  {picked.has(s) ? ", choisie" : ""})
                </span>
              </Label>
              <Select value={String(result.chosen[s])} onValueChange={(v) => onPick(s, Number(v))}>
                <SelectTrigger id={`choix-${s}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {choices.map((c) => (
                    <SelectItem key={c.index} value={String(c.index)}>
                      {describe(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      {picked.size > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Réinitialiser les choix
        </Button>
      )}
    </fieldset>
  );
}

const NO_PICKS: ReadonlyMap<number, number> = new Map();

/**
 * The player's picks over an extraction. They are forgotten when the extraction is redone (the
 * values typed changed): the possibilities are not the same any more.
 */
export function useExtractionChoices(base: ExtractCreatureResult | null | undefined) {
  const [picks, setPicks] = useState<{ base: ExtractCreatureResult | null | undefined; byStat: ReadonlyMap<number, number> }>({
    base,
    byStat: NO_PICKS,
  });
  const byStat = picks.base === base ? picks.byStat : NO_PICKS;
  const result = useMemo(() => {
    if (!base?.valid) return base;
    let r = resetChoices(base);
    for (const [stat, index] of byStat) if (base.results[stat]?.[index]) r = pickResult(r, stat, index);
    return r;
  }, [base, byStat]);
  return {
    result,
    picked: new Set(byStat.keys()) as ReadonlySet<number>,
    pick: (stat: number, index: number) => setPicks({ base, byStat: new Map(byStat).set(stat, index) }),
    reset: () => setPicks({ base, byStat: new Map() }),
  };
}
