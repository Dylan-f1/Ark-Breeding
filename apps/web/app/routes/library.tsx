import { settingsFingerprint, type Creature } from "@ark-breeding/core";
import { ChevronDown, Download, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, redirect, useRevalidator, useSearchParams, type ShouldRevalidateFunction } from "react-router";
import { toast } from "sonner";
import { ImportDropzone } from "~/components/library/import-dropzone";
import { ClosestToPerfect, SpeciesTable, analyseLine, nameOf, type LineAnalysis } from "~/components/library/species-table";
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
import { ApiError, deleteCreature, deleteCreatures, fetchLibrary, saveRecomputedLevels, updateCreature } from "~/lib/api";
import { downloadLibrary } from "~/lib/export-json";
import { autoLinkParents, libraryMutations, mutationSummary, mutationsToSave } from "~/lib/parents";
import { applySettingsToLibrary, recomputeSummary } from "~/lib/recompute";
import { useSpeciesData } from "~/lib/species";
import { cn } from "~/lib/utils";
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

  // EF-16: bred creatures imported before the parents were recognised get them on the next visit
  const linking = useRef(false);
  useEffect(() => {
    if (!speciesData || outdated || linking.current || !creatures.some((c) => c.kind === "bred")) return;
    linking.current = true;
    autoLinkParents(creatures, (id) => speciesData.prepared(id, tribe.settings.multipliers))
      .then((links) => {
        if (!links.linked) return;
        toast.success(`Parents reconnus pour ${links.linked} créature${links.linked > 1 ? "s" : ""}.`, {
          description: mutationSummary(links),
          duration: 10_000,
        });
        return revalidator.revalidate();
      })
      .catch(() => undefined)
      .finally(() => {
        linking.current = false;
      });
  }, [creatures, speciesData, outdated, tribe.settings.multipliers, revalidator]);
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get("q") ?? "",
    species: params.get("espece") ?? ALL,
    sex: params.get("sexe") ?? ALL,
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
        (matches(c.name, query) || speciesMatch.has(c.speciesId)),
    );
    const bySpecies = new Map<string, Creature[]>();
    for (const c of visible) bySpecies.set(c.speciesId, [...(bySpecies.get(c.speciesId) ?? []), c]);
    return speciesInLibrary.filter((s) => bySpecies.has(s.id)).map((s) => ({ ...s, creatures: bySpecies.get(s.id)! }));
  }, [creatures, query, filters.species, filters.sex, speciesInLibrary]);

  // EF-16: mutations read from the parents, over the whole library (parents may be filtered out)
  const mutations = useMemo(
    () => (speciesData ? libraryMutations(creatures, (id) => speciesData.prepared(id, tribe.settings.multipliers)) : undefined),
    [creatures, speciesData, tribe.settings.multipliers],
  );

  // D-26: mutations found from the parents are saved on the babies: deleting the parents later
  // (dead, no longer useful) keeps them
  const saving = useRef(false);
  async function saveMutations() {
    if (!mutations) return;
    const updates = mutationsToSave(creatures, mutations);
    if (updates.length) await saveRecomputedLevels(updates);
  }
  useEffect(() => {
    if (!mutations || outdated || saving.current || !mutationsToSave(creatures, mutations).length) return;
    saving.current = true;
    saveMutations()
      .then(() => revalidator.revalidate())
      .catch(() => undefined)
      .finally(() => {
        saving.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveMutations only reads these
  }, [mutations, creatures, outdated, revalidator]);

  // D-26: several creatures deleted at once
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  function toggle(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }
  async function removeMany(ids: string[], what: string) {
    if (!ids.length) return;
    if (!window.confirm(`Supprimer ${what} de la bibliothèque ? Leurs mutations restent enregistrées sur leurs petits.`)) return;
    try {
      await saveMutations();
      const n = await deleteCreatures(ids);
      setSelected(new Set());
      await revalidator.revalidate();
      toast.success(`${n} créature${n > 1 ? "s" : ""} supprimée${n > 1 ? "s" : ""}.`);
    } catch {
      toast.error("La suppression a échoué.");
    }
  }

  // D-36: the species a player owns no creature of are only in the species filter and on the add
  // page, not listed under the library. Compared by name: an import may use another blueprint
  const speciesWithout = useMemo(() => {
    if (!speciesData) return [];
    const inLibrary = new Set(speciesInLibrary.map((s) => s.label));
    return speciesData.catalog.filter((s) => !inLibrary.has(s.label));
  }, [speciesData, speciesInLibrary]);
  const filteredWithout = filters.species === ALL ? undefined : speciesWithout.find((s) => s.id === filters.species);

  // D-33
  async function rename(creature: Creature) {
    const name = window.prompt(`Nouveau nom pour ${nameOf(creature)} :`, creature.name)?.trim();
    if (!name || name === creature.name) return;
    try {
      await updateCreature(creature.id, { name: name.slice(0, 64) });
      await revalidator.revalidate();
      toast.success(`Renommé en « ${name.slice(0, 64)} ».`);
    } catch {
      toast.error("Le nom n'a pas pu être modifié.");
    }
  }

  async function remove(creature: Creature) {
    if (!window.confirm(`Supprimer ${nameOf(creature)} de la bibliothèque ?`)) return;
    try {
      await saveMutations();
      await deleteCreature(creature.id);
      await revalidator.revalidate();
      toast.success(`${nameOf(creature)} a été supprimé.`);
    } catch {
      toast.error("La suppression a échoué.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl leading-none font-semibold [font-stretch:62%]">Bibliothèque</h1>
          <p className="mt-1.5 text-muted-foreground">{tribe.name}</p>
        </div>
        {/* D-35: the readouts of the game interface; on phones the species panels give the counts */}
        <dl className="hidden border bg-card md:flex">
          {(
            [
              ["Créatures", creatures.length],
              ["Espèces", speciesInLibrary.length],
              ["Serveur", tribe.server?.name ?? "Réglages de la tribu"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="border-l px-4 py-1.5 first:border-l-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="max-w-48 truncate text-xl leading-tight font-semibold [font-stretch:75%]" title={String(value)}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          {creatures.length > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                downloadLibrary(loaderData)
                  .then((n) => toast.success(`Bibliothèque exportée (${n} créature${n > 1 ? "s" : ""}).`))
                  .catch(() => toast.error("L'export a échoué."))
              }
            >
              <Download className="size-4" aria-hidden /> Exporter (JSON)
            </Button>
          )}
          <Button asChild variant={creatures.length ? "outline" : "default"}>
            <Link to="/bibliotheque/ajouter">
              <Plus className="size-4" aria-hidden /> Ajouter à la main
            </Link>
          </Button>
          {/* D-35: once the library is filled, importing is the main action, as a button; export
              files live on the gaming PC, so it is for desktop screens */}
          {creatures.length > 0 && (
            <div className="hidden sm:contents">
              <ImportDropzone compact settings={tribe.settings} onImported={() => void revalidator.revalidate()} />
            </div>
          )}
        </div>
      </div>

      {/* first visit: the full drop zone, with the default folder of the exports */}
      {creatures.length === 0 && (
        <div className="hidden sm:block">
          <ImportDropzone settings={tribe.settings} onImported={() => void revalidator.revalidate()} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3" role="search" aria-label="Filtres">
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
        filteredWithout ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-muted-foreground">Aucun {filteredWithout.label} dans ta bibliothèque.</p>
            <Button asChild size="sm">
              <Link to={`/bibliotheque/ajouter?espece=${encodeURIComponent(filteredWithout.id)}`}>
                <Plus className="size-4" aria-hidden /> Ajouter un {filteredWithout.label}
              </Link>
            </Button>
          </div>
        ) : (
          <p className="py-4 text-center text-muted-foreground">Aucune créature ne correspond à ces filtres.</p>
        )
      ) : (
        groups.map((g) => {
          const prepared = speciesData.prepared(g.id, tribe.settings.multipliers);
          const line = prepared ? analyseLine(prepared, g.creatures, mutations) : undefined;
          return (
            <SpeciesPanel key={g.id} id={g.id} label={g.label} count={g.creatures.length} line={line}>
              {prepared && line ? (
                <SpeciesTable
                  line={line}
                  speciesData={speciesData}
                  creatures={g.creatures}
                  mutations={mutations}
                  selected={selected}
                  onSelect={toggle}
                  onRename={rename}
                  onDelete={remove}
                />
              ) : (
                <p className="text-sm text-destructive">Espèce inconnue dans les données actuelles.</p>
              )}
            </SpeciesPanel>
          );
        })
      )}

      {selected.size > 0 && (
        <div
          className="sticky bottom-20 z-10 mx-auto flex w-fit md:bottom-4 flex-wrap items-center gap-3 rounded-lg border bg-background px-4 py-2 shadow-lg"
          role="region"
          aria-label="Sélection"
        >
          <span className="text-sm">
            {selected.size} sélectionnée{selected.size > 1 ? "s" : ""}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void removeMany([...selected], `${selected.size} créature${selected.size > 1 ? "s" : ""}`)}
          >
            <Trash2 className="size-4" aria-hidden /> Supprimer
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}

/** D-35: a species as a panel of the game interface (cut corners), its answer in the head. */
function SpeciesPanel(props: { id: string; label: string; count: number; line?: LineAnalysis; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section
      aria-labelledby={`espece-${props.id}`}
      className="bg-card [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,16px_100%,0_calc(100%-16px))]"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-primary bg-panel-2 px-4 py-3">
        <h2 id={`espece-${props.id}`} className="text-2xl leading-tight font-semibold [font-stretch:65%]">
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5">
            <ChevronDown className={cn("size-5 text-muted-foreground", !open && "-rotate-90")} aria-hidden />
            {props.label}
          </button>
        </h2>
        <span className="mr-auto text-sm text-muted-foreground">
          {props.count} dino{props.count > 1 ? "s" : ""}
        </span>
        <Button asChild size="sm">
          <Link to={`/lignee/${props.id}`}>Plan d'élevage</Link>
        </Button>
        {props.line && props.line.ranked.length > 0 && (
          <div className="basis-full">
            <ClosestToPerfect line={props.line} />
          </div>
        )}
      </div>
      {open && <div className="px-4 py-3">{props.children}</div>}
    </section>
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
