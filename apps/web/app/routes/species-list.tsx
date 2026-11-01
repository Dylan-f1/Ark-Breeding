import { buildCatalog } from "@ark-breeding/core";
import { useState } from "react";
import { Link } from "react-router";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SITE_URL } from "~/lib/site";
import type { Route } from "./+types/species-list";

const DESCRIPTION =
  "Toutes les créatures d'ARK Survival Ascended que l'on peut apprivoiser et élever : stats de base, temps d'incubation et de maturation.";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Espèces d'ARK Survival Ascended : stats et élevage — Ark-breeding" },
    { name: "description", content: DESCRIPTION },
    { tagName: "link", rel: "canonical", href: `${SITE_URL}/especes` },
  ];
}

// EF-18: built once, at compile time (pre-rendered page, ENF-05)
export async function loader() {
  const { ASA_SPECIES } = await import("@ark-breeding/core/species-data");
  return { species: buildCatalog(ASA_SPECIES).map(({ label, slug }) => ({ label, slug })) };
}

export default function SpeciesList({ loaderData }: Route.ComponentProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("fr");
  const shown = loaderData.species.filter((s) => !q || s.label.toLocaleLowerCase("fr").includes(q));
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Espèces d'ARK Survival Ascended</h1>
        <p className="text-muted-foreground">{DESCRIPTION}</p>
      </div>
      <div className="max-w-sm space-y-1">
        <Label htmlFor="recherche-espece">Rechercher une espèce</Label>
        <Input
          id="recherche-espece"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rex, Wyvern…"
        />
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {shown.length} espèce{shown.length > 1 ? "s" : ""}
      </p>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((s) => (
          <li key={s.slug}>
            <Link to={`/especes/${s.slug}`} className="block rounded-md border px-3 py-2 text-sm hover:bg-accent">
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
