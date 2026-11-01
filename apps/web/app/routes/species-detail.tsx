import { buildCatalog } from "@ark-breeding/core";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { SITE_URL } from "~/lib/site";
import { formatDuration, formatStat, speciesPageData } from "~/lib/species-page";
import type { Route } from "./+types/species-detail";

// EF-18: built at compile time for every species (pre-rendered page, ENF-05)
export async function loader({ params }: Route.LoaderArgs) {
  const { ASA_SPECIES } = await import("@ark-breeding/core/species-data");
  const catalog = buildCatalog(ASA_SPECIES);
  const i = catalog.findIndex((e) => e.slug === params.slug);
  if (i < 0) throw new Response("Espèce inconnue", { status: 404 });
  // neighbours: links between the pages, for the crawlers
  const near = (j: number) => {
    const e = catalog[j];
    return e ? { label: e.label, slug: e.slug } : null;
  };
  return { species: speciesPageData(catalog[i]!), previous: near(i - 1), next: near(i + 1) };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Espèce introuvable — Ark-breeding" }];
  const { label, slug, breeding } = data.species;
  const times = breeding
    ? ` ${breeding.birth.kind === "egg" ? "Incubation" : "Gestation"} : ${formatDuration(breeding.birth.seconds)}, maturation : ${formatDuration(breeding.maturation)}.`
    : "";
  const title = `${label} : stats, incubation et maturation (ARK Survival Ascended) — Ark-breeding`;
  const description = `Stats de base et gain par niveau du ${label} dans ARK Survival Ascended.${times} Suis tes lignées, mutations et meilleurs couples avec Ark-breeding.`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { tagName: "link", rel: "canonical", href: `${SITE_URL}/especes/${slug}` },
  ];
}

export default function SpeciesDetail({ loaderData }: Route.ComponentProps) {
  const { species, previous, next } = loaderData;
  const { breeding } = species;
  return (
    <article className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/especes">
            <ArrowLeft className="size-4" aria-hidden /> Toutes les espèces
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold">{species.label}</h1>
        <p className="text-muted-foreground">
          Stats et élevage dans ARK Survival Ascended
          {species.origin && ` · ${species.origin}`}
          {species.flyer && " · Volant"}
          {species.noGender && " · Sans sexe"}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild>
            <Link to={`/bibliotheque/ajouter?espece=${encodeURIComponent(species.id)}`}>Ajouter à mon élevage</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/lignee/${encodeURIComponent(species.id)}`}>Plan d'élevage</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Stats de base</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stat</TableHead>
                  <TableHead className="text-right">Niveau 1</TableHead>
                  <TableHead className="text-right">Par niveau sauvage</TableHead>
                  <TableHead className="text-right">Par niveau domestique</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {species.stats.map((s) => (
                  <TableRow key={s.stat}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatStat(s.base, s.percent)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.perWildLevel > 0 ? `+${formatStat(s.perWildLevel, s.percent)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.perDomLevel > 0 ? `+${formatStat(s.perDomLevel, s.percent)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              Aux taux officiels. Niveau domestique : créature apprivoisée à 100 % d'efficacité.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Élevage</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {breeding ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{breeding.birth.kind === "egg" ? "Incubation" : "Gestation"}</dt>
                  <dd>{formatDuration(breeding.birth.seconds)}</dd>
                  <dt className="text-muted-foreground">Maturation</dt>
                  <dd>{formatDuration(breeding.maturation)}</dd>
                  <dt className="text-muted-foreground">Entre deux accouplements</dt>
                  <dd>
                    {formatDuration(breeding.matingCooldown[0])} à {formatDuration(breeding.matingCooldown[1])}
                  </dd>
                  {breeding.eggTemperature && (
                    <>
                      <dt className="text-muted-foreground">Température de l'œuf</dt>
                      <dd>
                        {breeding.eggTemperature[0]} à {breeding.eggTemperature[1]} °C
                      </dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Cette créature ne se reproduit pas.</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Aux taux officiels (x1).</p>
            </CardContent>
          </Card>

          {species.colorRegions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Régions de couleur</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {species.colorRegions.map((r) => (
                    <li key={r.index}>
                      <span className="text-muted-foreground">Région {r.index} :</span> {r.name}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <nav aria-label="Espèces voisines" className="flex justify-between gap-4 border-t pt-4 text-sm">
        {previous ? (
          <Link to={`/especes/${previous.slug}`} className="underline-offset-2 hover:underline">
            ← {previous.label}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/especes/${next.slug}`} className="underline-offset-2 hover:underline">
            {next.label} →
          </Link>
        )}
      </nav>
    </article>
  );
}
