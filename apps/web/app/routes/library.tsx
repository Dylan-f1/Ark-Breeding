import {
  CREATURE_STATUS_LABELS,
  CREATURE_STATUSES,
  settingsFingerprint,
  type Creature,
  type CreatureStatus,
} from "@ark-breeding/core";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Link, redirect, useRevalidator, useSearchParams, type ShouldRevalidateFunction } from "react-router";
import { toast } from "sonner";
import { ImportDropzone } from "~/components/library/import-dropzone";
import { SpeciesTable } from "~/components/library/species-table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ApiError, deleteCreature, fetchLibrary, updateCreature } from "~/lib/api";
import { libraryMutations } from "~/lib/parents";
import { applySettingsToLibrary, recomputeSummary } from "~/lib/recompute";
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
const matches = (text: string, query: string) => !query || text.toLocaleLowerCase("fr").includes(query);

export default function Library({ loaderData }: Route.ComponentProps) {
  const { tribe, creatures } = loaderData;
  const speciesData = useSpeciesData();
  const revalidator = useRevalidator();

  // EF-27: the followed server was edited since the levels were computed: recompute them once
  const recomputing = useRef(false);
  const outdated = !!tribe.levelsFingerprint && tribe.levelsFingerprint !== settingsFingerprint(tribe.settings);
  useEffect(() => {
    if (!outdated || recomputing.current) return;
    recomputing.current = true;
    applySettingsToLibrary(tribe.settings)
      .then((summary) => {
        toast.info(
          tribe.server ? `Les réglages du serveur « ${tribe.server.name} » ont changé.` : "Les réglages du serveur ont changé.",
          { description: recomputeSummary(summary), duration: 10_000 },
        );
        return revalidator.revalidate();
      })
      .catch(() => toast.error("Les niveaux n'ont pas pu être recalculés avec les nouveaux réglages."))
      .finally(() => {
        recomputing.current = false;
      });
  }, [outdated, tribe.settings, tribe.server, revalidator]);
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

  const query = filters.q.trim().toLocaleLowerCase("fr");

  // EF-10: filters run client side, a library of 1 000 creatures stays instant
  const groups = useMemo(() => {
    const speciesMatch = new Set(speciesInLibrary.filter((s) => matches(s.label, query)).map((s) => s.id));
    const visible = creatures.filter(
      (c) =>
        (filters.species === ALL || c.speciesId === filters.species) &&
        (filters.sex === ALL || c.sex === filters.sex) &&
        (filters.status === ALL || c.status === filters.status) &&
        (matches(c.name, query) || speciesMatch.has(c.speciesId)),
    );
    const bySpecies = new Map<string, Creature[]>();
    for (const c of visible) bySpecies.set(c.speciesId, [...(bySpecies.get(c.speciesId) ?? []), c]);
    return speciesInLibrary.filter((s) => bySpecies.has(s.id)).map((s) => ({ ...s, creatures: bySpecies.get(s.id)! }));
  }, [creatures, query, filters.species, filters.sex, filters.status, speciesInLibrary]);

  // EF-16: mutations read from the parents, over the whole library (parents may be filtered out)
  const mutations = useMemo(
    () => (speciesData ? libraryMutations(creatures, (id) => speciesData.prepared(id, tribe.settings.multipliers)) : undefined),
    [creatures, speciesData, tribe.settings.multipliers],
  );

  // every species a player can own is listed, even without creatures: the library is the way in to
  // all of them. Compared by name: an import may use another blueprint of the same creature
  const speciesWithout = useMemo(() => {
    if (!speciesData) return [];
    const inLibrary = new Set(speciesInLibrary.map((s) => s.label));
    return speciesData.catalog.filter((s) => !inLibrary.has(s.label));
  }, [speciesData, speciesInLibrary]);
  const otherSpecies =
    filters.species === ALL
      ? speciesWithout.filter((s) => matches(s.label, query))
      : speciesWithout.filter((s) => s.id === filters.species);

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filtres">
        <div className="space-y-1">
          <Label htmlFor="filtre-nom">Recherche</Label>
          <Input
            id="filtre-nom"
            type="search"
            placeholder="Dino ou espèce…"
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value, "")}
          />
        </div>
        <FilterSelect
          id="filtre-espece"
          label="Espèce"
          value={filters.species}
          onChange={(v) => setFilter("espece", v)}
          groups={[
            { options: [{ value: ALL, label: "Toutes" }] },
            { label: "Dans ta bibliothèque", options: speciesInLibrary.map((s) => ({ value: s.id, label: s.label })) },
            { label: "Autres espèces", options: speciesWithout.map((s) => ({ value: s.id, label: s.label })) },
          ]}
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

      {creatures.length === 0 ? (
        <p className="py-4 text-center text-muted-foreground">
          Ta bibliothèque est vide. Importe tes exports ou ajoute un dino à la main.
        </p>
      ) : !speciesData ? (
        <p className="text-muted-foreground" role="status">
          Chargement des espèces…
        </p>
      ) : groups.length === 0 ? (
        otherSpecies.length === 0 && <p className="py-4 text-center text-muted-foreground">Aucune créature ne correspond à ces filtres.</p>
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
                  mutations={mutations}
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

      {otherSpecies.length > 0 && (
        <section aria-labelledby="autres-especes" className="space-y-2">
          <h2 id="autres-especes" className="text-lg font-semibold">
            {creatures.length ? "Autres espèces" : "Espèces"}{" "}
            <span className="text-sm font-normal text-muted-foreground">({otherSpecies.length}, aucun dino enregistré)</span>
          </h2>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {otherSpecies.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/bibliotheque/ajouter?espece=${encodeURIComponent(s.id)}`}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                  title={`Ajouter un ${s.label}`}
                >
                  {s.label}
                  <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Option = { value: string; label: string };

function FilterSelect(props: {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  /** Flat list, or sections with a heading. */
  options?: Option[];
  groups?: { label?: string; options: Option[] }[];
}) {
  const groups = (props.groups ?? [{ options: props.options ?? [] }]).filter((g) => g.options.length);
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger id={props.id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {groups.map((g, i) => (
            <SelectGroup key={g.label ?? i}>
              {i > 0 && <SelectSeparator />}
              {g.label && <SelectLabel>{g.label}</SelectLabel>}
              {g.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
