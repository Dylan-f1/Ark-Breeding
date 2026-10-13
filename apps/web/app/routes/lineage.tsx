import {
  MUTATION_LIMIT,
  STAT_NAMES_FR,
  STAT_SHORT_NAMES_FR,
  planBreeding,
  type BreedingCandidate,
  type Creature,
} from "@ark-breeding/core";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { Link, redirect, useSearchParams, type ShouldRevalidateFunction } from "react-router";
import { breedableStats, wildPoints } from "~/components/library/species-table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ApiError, fetchLibrary } from "~/lib/api";
import { useSpeciesData } from "~/lib/species";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/lineage";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Plan d'élevage — Ark-breeding" }];
}

export async function clientLoader() {
  try {
    return await fetchLibrary();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw redirect("/connexion");
    throw e;
  }
}

// the stat selection lives in the query string: no refetch when it changes
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) =>
  currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search ? false : defaultShouldRevalidate;

const percent = (x: number, digits = 1) => `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`;

function toCandidate(c: Creature, stats: number[]): BreedingCandidate {
  const points = Array<number>(12).fill(0);
  for (const s of stats) points[s] = wildPoints(c, s);
  return { id: c.id, name: c.name, sex: c.sex, points, mutationsMother: c.mutationsMother, mutationsFather: c.mutationsFather };
}

/** EF-12 / EF-13: the 5 best pairs of a line. */
export default function Lineage({ loaderData, params }: Route.ComponentProps) {
  const { tribe, creatures } = loaderData;
  const speciesData = useSpeciesData();
  const [search, setSearch] = useSearchParams();
  const option = speciesData?.byId(params.speciesId);
  const species = speciesData?.prepared(params.speciesId, tribe.settings.multipliers);
  const allStats = species ? breedableStats(species) : [];
  const excluded = new Set((search.get("sans") ?? "").split(",").filter(Boolean).map(Number));
  const stats = allStats.filter((s) => !excluded.has(s));

  const line = creatures.filter((c) => c.speciesId === params.speciesId);
  const byId = new Map(line.map((c) => [c.id, c]));
  // only living, available, fertile creatures can be bred
  const candidates = line.filter((c) => c.status === "available" && !c.neutered);

  const plan = useMemo(
    () => planBreeding(candidates.map((c) => toCandidate(c, stats)), stats, { noGender: species?.raw.noGender }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [creatures, stats.join(","), species],
  );

  function toggleStat(s: number) {
    const next = new Set(excluded);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSearch(
      (p) => {
        if (next.size) p.set("sans", [...next].join(","));
        else p.delete("sans");
        return p;
      },
      { replace: true },
    );
  }

  if (!speciesData) return <p role="status" className="text-muted-foreground">Chargement…</p>;
  if (!option || !species) return <p className="text-destructive">Espèce inconnue.</p>;

  const females = candidates.filter((c) => c.sex === "female").length;
  const males = candidates.filter((c) => c.sex === "male").length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/bibliotheque?espece=${params.speciesId}`}>
            <ArrowLeft className="size-4" aria-hidden /> Bibliothèque
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Plan d'élevage : {option.label}</h1>
        <p className="text-sm text-muted-foreground">
          {species.raw.noGender
            ? `${candidates.length} créatures disponibles`
            : `${females} femelle${females > 1 ? "s" : ""} et ${males} mâle${males > 1 ? "s" : ""} disponibles`}
          {" "}(non stérilisés)
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Stats à améliorer</legend>
        <div className="flex flex-wrap gap-2">
          {allStats.map((s) => {
            const on = !excluded.has(s);
            return (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={on ? "default" : "outline"}
                aria-pressed={on}
                onClick={() => toggleStat(s)}
              >
                {STAT_NAMES_FR[s]}
              </Button>
            );
          })}
        </div>
      </fieldset>

      {stats.length === 0 ? (
        <p className="text-muted-foreground">Choisis au moins une stat.</p>
      ) : plan.pairs.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">
          Il faut au moins une femelle et un mâle disponibles pour proposer un couple.
        </p>
      ) : (
        <ol className="space-y-4" aria-label="Meilleurs couples">
          {plan.pairs.map((pair, i) => {
            const mother = byId.get(pair.motherId)!;
            const father = byId.get(pair.fatherId)!;
            const capped = [mother, father].filter((p) => p.mutationsMother + p.mutationsFather >= MUTATION_LIMIT);
            return (
              <li key={`${pair.motherId}-${pair.fatherId}`}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-muted-foreground">#{i + 1}</span>
                      <span>
                        <Link to={`/creature/${mother.id}`} className="underline-offset-2 hover:underline">
                          {mother.name}
                        </Link>
                        {species.raw.noGender ? " × " : " ♀ × ♂ "}
                        <Link to={`/creature/${father.id}`} className="underline-offset-2 hover:underline">
                          {father.name}
                        </Link>
                      </span>
                      <Badge variant="secondary" className="ml-auto">
                        Score {percent(pair.score, 0)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="flex flex-wrap gap-2" aria-label="Meilleures valeurs transmissibles">
                      {stats.map((s) => {
                        const top = pair.topStats.includes(s);
                        return (
                          <li
                            key={s}
                            className={cn(
                              "rounded-md border px-2 py-1 text-sm tabular-nums",
                              top && "border-primary/50 bg-primary/15 font-semibold text-primary",
                            )}
                            title={`${STAT_NAMES_FR[s]} : ${pair.bestPoints[s]} points (meilleur de la lignée : ${plan.linePoints[s]})`}
                          >
                            {STAT_SHORT_NAMES_FR[s]} {pair.bestPoints[s]}
                            {top && <span className="sr-only"> (meilleure valeur de la lignée)</span>}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      {pair.topStats.length} / {stats.length} meilleures stats de la lignée · bébé avec toutes les meilleures
                      stats du couple : <span className="text-foreground">{percent(pair.perfectChance)}</span> · mutation :{" "}
                      <span className="text-foreground">{percent(pair.mutationChance)}</span>
                    </p>
                    {capped.length > 0 && (
                      <p className="text-sm text-destructive">
                        {capped.map((p) => p.name).join(" et ")} {capped.length > 1 ? "ont" : "a"} atteint {MUTATION_LIMIT} mutations :
                        plus de mutation venant de {capped.length > 1 ? "ces parents" : "ce parent"}.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
