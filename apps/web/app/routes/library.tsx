import { CREATURE_STATUS_LABELS, CREATURE_STATUSES, type Creature, type CreatureStatus } from "@ark-breeding/core";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { Link, redirect, useRevalidator, useSearchParams, type ShouldRevalidateFunction } from "react-router";
import { toast } from "sonner";
import { ImportDropzone } from "~/components/library/import-dropzone";
import { SpeciesTable } from "~/components/library/species-table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ApiError, deleteCreature, fetchLibrary, updateCreature } from "~/lib/api";
import { useSpeciesData } from "~/lib/species";
import type { Route } from "./+types/library";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Bibliothèque — Ark-breeding" }];
}

export async function clientLoader() {
  try {
    return await fetchLibrary();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw redirect("/connexion");
    throw e;
  }
}

// Filters live in the query string: changing them must not refetch the library.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) => {
  if (currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search) return false;
  return defaultShouldRevalidate;
};

const ALL = "all";
const SEX_FILTERS = { female: "Femelles", male: "Mâles" } as const;

export default function Library({ loaderData }: Route.ComponentProps) {
  const { tribe, creatures } = loaderData;
  const speciesData = useSpeciesData();
  const revalidator = useRevalidator();
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get("q") ?? "",
    species: params.get("espece") ?? ALL,
    sex: params.get("sexe") ?? ALL,
    status: params.get("statut") ?? "available",
  };

  function setFilter(key: string, value: string, fallback = ALL) {
    setParams(
      (p) => {
        if (value === fallback || value === "") p.delete(key);
        else p.set(key, value);
        return p;
      },
      { replace: true },
    );
  }

  const speciesInLibrary = useMemo(() => {
    const ids = [...new Set(creatures.map((c) => c.speciesId))];
    return ids
      .map((id) => ({ id, label: speciesData?.byId(id)?.label ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [creatures, speciesData]);

  // EF-10: filters run client side, a library of 1 000 creatures stays instant
  const groups = useMemo(() => {
    const q = filters.q.trim().toLocaleLowerCase("fr");
    const visible = creatures.filter(
      (c) =>
        (filters.species === ALL || c.speciesId === filters.species) &&
        (filters.sex === ALL || c.sex === filters.sex) &&
        (filters.status === ALL || c.status === filters.status) &&
        (!q || c.name.toLocaleLowerCase("fr").includes(q)),
    );
    const bySpecies = new Map<string, Creature[]>();
    for (const c of visible) bySpecies.set(c.speciesId, [...(bySpecies.get(c.speciesId) ?? []), c]);
    return speciesInLibrary.filter((s) => bySpecies.has(s.id)).map((s) => ({ ...s, creatures: bySpecies.get(s.id)! }));
  }, [creatures, filters.q, filters.species, filters.sex, filters.status, speciesInLibrary]);

  async function changeStatus(creature: Creature, status: CreatureStatus) {
    try {
      await updateCreature(creature.id, { status });
      await revalidator.revalidate();
    } catch {
      toast.error("Le statut n'a pas pu être modifié.");
    }
  }

  async function remove(creature: Creature) {
    if (!window.confirm(`Supprimer ${creature.name} de la bibliothèque ?`)) return;
    try {
      await deleteCreature(creature.id);
      await revalidator.revalidate();
      toast.success(`${creature.name} a été supprimé.`);
    } catch {
      toast.error("La suppression a échoué.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bibliothèque</h1>
          <p className="text-sm text-muted-foreground">
            {tribe.name} · {creatures.length} créature{creatures.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link to="/bibliotheque/ajouter">
            <Plus className="size-4" aria-hidden /> Ajouter à la main
          </Link>
        </Button>
      </div>

      {/* export files live on the gaming PC: the drop zone is for desktop screens */}
      <div className="hidden sm:block">
        <ImportDropzone settings={tribe.settings} onImported={() => void revalidator.revalidate()} />
      </div>

      {creatures.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filtres">
          <div className="space-y-1">
            <Label htmlFor="filtre-nom">Nom</Label>
            <Input
              id="filtre-nom"
              type="search"
              placeholder="Rechercher…"
              value={filters.q}
              onChange={(e) => setFilter("q", e.target.value, "")}
            />
          </div>
          <FilterSelect
            id="filtre-espece"
            label="Espèce"
            value={filters.species}
            onChange={(v) => setFilter("espece", v)}
            options={[{ value: ALL, label: "Toutes" }, ...speciesInLibrary.map((s) => ({ value: s.id, label: s.label }))]}
          />
          <FilterSelect
            id="filtre-sexe"
            label="Sexe"
            value={filters.sex}
            onChange={(v) => setFilter("sexe", v)}
            options={[{ value: ALL, label: "Tous" }, ...Object.entries(SEX_FILTERS).map(([value, label]) => ({ value, label }))]}
          />
          <FilterSelect
            id="filtre-statut"
            label="Statut"
            value={filters.status}
            onChange={(v) => setFilter("statut", v, "available")}
            options={[{ value: ALL, label: "Tous" }, ...CREATURE_STATUSES.map((s) => ({ value: s, label: CREATURE_STATUS_LABELS[s] }))]}
          />
        </div>
      )}

      {creatures.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Ta bibliothèque est vide. Importe tes exports ou ajoute un dino à la main.
        </p>
      ) : !speciesData ? (
        <p className="text-muted-foreground" role="status">
          Chargement des espèces…
        </p>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Aucune créature ne correspond à ces filtres.</p>
      ) : (
        groups.map((g) => {
          const prepared = speciesData.prepared(g.id, tribe.settings.multipliers);
          return (
            <section key={g.id} aria-labelledby={`espece-${g.id}`} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`espece-${g.id}`} className="text-lg font-semibold">
                  {g.label} <span className="text-sm font-normal text-muted-foreground">({g.creatures.length})</span>
                </h2>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/lignee/${g.id}`}>Plan d'élevage</Link>
                </Button>
              </div>
              {prepared ? (
                <SpeciesTable
                  species={prepared}
                  speciesData={speciesData}
                  creatures={g.creatures}
                  onStatusChange={changeStatus}
                  onDelete={remove}
                />
              ) : (
                <p className="text-sm text-destructive">Espèce inconnue dans les données actuelles.</p>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function FilterSelect(props: {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger id={props.id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
