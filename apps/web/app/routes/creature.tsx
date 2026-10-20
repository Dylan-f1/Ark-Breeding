import {
  CREATURE_STATUS_LABELS,
  MUTATION_LIMIT,
  SEX_LABELS,
  STAT_DISPLAY_ORDER,
  STAT_NAMES_FR,
  chosenLevels,
  createParentResolver,
  withMutatedLevels,
  extractCreature,
  type PreparedSpecies,
  type ServerSettings,
  type ParentCandidate,
  isPercentageStat,
  type Creature,
  type UpdateCreatureRequest,
} from "@ark-breeding/core";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, redirect, useRevalidator } from "react-router";
import { toast } from "sonner";
import { ExtractionChoices, useExtractionChoices } from "~/components/library/extraction-choices";
import { PedigreeTree } from "~/components/library/pedigree-tree";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ApiError, fetchLibrary, saveRecomputedLevels, updateCreature } from "~/lib/api";
import { stackLabel, stackTitle } from "~/components/library/species-table";
import { creatureMutations, describeMutation, linkParents, parentCandidates, type MutationInfo } from "~/lib/parents";
import { useSpeciesData } from "~/lib/species";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/creature";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.creature.name ?? "Créature"} — Ark-breeding` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  try {
    const library = await fetchLibrary();
    const creature = library.creatures.find((c) => c.id === params.id);
    if (!creature) throw new Response("Créature introuvable", { status: 404 });
    return { ...library, creature };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw redirect("/connexion");
    throw e;
  }
}

const NONE = "none";
const KIND_LABELS = { wild: "Sauvage", tamed: "Apprivoisé", bred: "Élevé" } as const;
const percent = (x: number) => `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const formatValue = (v: number, s: number) =>
  isPercentageStat(s) ? percent(v) : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default function CreaturePage({ loaderData }: Route.ComponentProps) {
  const { creature, creatures, tribe } = loaderData;
  const speciesData = useSpeciesData();
  const revalidator = useRevalidator();
  const species = speciesData?.byId(creature.speciesId);
  const prepared = speciesData?.prepared(creature.speciesId, tribe.settings.multipliers);
  const resolve = createParentResolver(creatures);
  const sameSpecies = creatures.filter((c) => c.speciesId === creature.speciesId && c.id !== creature.id);
  const children = resolve.children(creature);

  async function save(patch: UpdateCreatureRequest, success: string) {
    try {
      await updateCreature(creature.id, patch);
      toast.success(success);
      await revalidator.revalidate();
    } catch {
      toast.error("La modification a échoué.");
    }
  }

  const stats = STAT_DISPLAY_ORDER.filter((s) => prepared?.usesStat(s) && (creature.statValues[s] ?? 0) > 0);
  // mutations read from the parents (ASA export counters are unreliable)
  const mutationInfo = speciesData
    ? creatureMutations(creature, creatures, (id) => speciesData.prepared(id, tribe.settings.multipliers))
    : { mutations: [], mother: creature.mutationsMother, father: creature.mutationsFather, deduced: false, stacks: [], unsure: [] };
  const { mutations } = mutationInfo;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/bibliotheque?espece=${creature.speciesId}`}>
            <ArrowLeft className="size-4" aria-hidden /> Bibliothèque
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{creature.name}</h1>
        <p className="text-sm text-muted-foreground">
          {species?.label ?? creature.speciesId} · {SEX_LABELS[creature.sex]} · niveau {creature.level} ·{" "}
          {KIND_LABELS[creature.kind]}
          {creature.tamingEffectiveness !== null && ` (efficacité ${percent(creature.tamingEffectiveness)})`}
          {creature.kind === "bred" && ` (imprégnation ${percent(creature.imprintingBonus)})`} ·{" "}
          {CREATURE_STATUS_LABELS[creature.status]}
          {creature.neutered && " · stérilisé"}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to={`/lignee/${creature.speciesId}`}>Plan d'élevage de la lignée</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Stats</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stat</TableHead>
                  <TableHead className="text-right">Valeur</TableHead>
                  <TableHead className="text-right">Sauvage</TableHead>
                  <TableHead className="text-right">Mutations</TableHead>
                  <TableHead className="text-right">Domestique</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((s) => (
                  <TableRow key={s}>
                    <TableCell>{STAT_NAMES_FR[s]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatValue(creature.statValues[s] ?? 0, s)}</TableCell>
                    <TableCell className="text-right tabular-nums">{(creature.levelsWild[s] ?? 0) < 0 ? "?" : creature.levelsWild[s]}</TableCell>
                    <TableCell
                      className={cn("text-right tabular-nums", stackLabel(mutationInfo, s) && "font-semibold text-amber-600 dark:text-amber-400")}
                      title={stackTitle(mutationInfo, s) || undefined}
                    >
                      {stackLabel(mutationInfo, s) || 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Math.max(0, creature.levelsDom[s] ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!creature.extractionUnique && (
              <p className="mt-2 text-xs text-muted-foreground">
                Plusieurs combinaisons de niveaux étaient possibles : la plus probable est affichée.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {prepared && !creature.extractionUnique && creature.kind !== "wild" && (
            <ExtractionCard
              creature={creature}
              species={prepared}
              settings={tribe.settings}
              onSaved={async () => {
                toast.success("Répartition des niveaux enregistrée.");
                await revalidator.revalidate();
              }}
            />
          )}
          <MutationsCard key={`${mutationInfo.mother}/${mutationInfo.father}`} creature={creature} info={mutationInfo} onSave={save} />
          <ParentsCard
            creature={creature}
            candidates={sameSpecies}
            resolve={resolve}
            suggestions={
              prepared && creature.kind === "bred" && !resolve.mother(creature) && !resolve.father(creature)
                ? parentCandidates(creature, creatures, prepared)
                : []
            }
            onSave={save}
            onLink={async (candidate) => {
              try {
                await linkParents(creature, candidate);
                toast.success("Parents enregistrés.", {
                  description: candidate.mutations.length
                    ? `Mutation : ${candidate.mutations.map(describeMutation).join(", ")}.`
                    : undefined,
                });
                await revalidator.revalidate();
              } catch {
                toast.error("La modification a échoué.");
              }
            }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Arbre généalogique</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PedigreeTree creature={creature} creatures={creatures} />
          {children.length > 0 && (
            <p className="text-sm">
              <span className="text-muted-foreground">Descendants : </span>
              {children.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link to={`/creature/${c.id}`} className="underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * EF-09: an imported or typed creature whose values fit several level splits. The player checks
 * the split and confirms it: the "À vérifier" badge goes away.
 */
function ExtractionCard({
  creature,
  species,
  settings,
  onSaved,
}: {
  creature: Creature;
  species: PreparedSpecies;
  settings: ServerSettings;
  onSaved(): Promise<void>;
}) {
  const base = useMemo(
    () =>
      extractCreature({
        species,
        level: creature.level,
        statValues: creature.statValues,
        kind: creature.kind,
        imprintingBonus: creature.imprintingBonus,
        highPrecisionInputs: creature.arkId !== null,
        maxWildLevel: settings.maxWildLevel,
      }),
    [creature, species, settings.maxWildLevel],
  );
  // never confirmed: the levels saved are the most probable split, which the extraction gives again
  const choices = useExtractionChoices(base.valid ? base : null);
  const [saving, setSaving] = useState(false);
  const result = choices.result;
  if (!result?.valid) return null;

  async function confirm() {
    if (!result?.valid) return;
    setSaving(true);
    const levels = chosenLevels(result);
    try {
      await saveRecomputedLevels([
        {
          id: creature.id,
          ...levels,
          // D-26: mutations found from the parents stay
          ...withMutatedLevels(levels, creature.levelsMutated),
          tamingEffectiveness:
            result.kind === "tamed" && result.tamingEffectiveness >= 0 ? Math.min(1, result.tamingEffectiveness) : null,
          imprintingBonus: result.kind === "bred" ? result.imprintingBonus : 0,
          extractionUnique: true,
        },
      ]);
      await onSaved();
    } catch {
      toast.error("La modification a échoué.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Niveaux à vérifier</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ExtractionChoices result={result} picked={choices.picked} onPick={choices.pick} onReset={choices.reset} />
        <Button size="sm" disabled={saving} onClick={() => void confirm()}>
          {saving ? "Enregistrement…" : "Valider cette répartition"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** EF-15: mother side and father side, alert at 20. */
function MutationsCard({
  creature,
  info,
  onSave,
}: {
  creature: Creature;
  /** Counters and mutated stats found from the parents. */
  info: MutationInfo;
  onSave(p: UpdateCreatureRequest, msg: string): Promise<void>;
}) {
  const [mother, setMother] = useState(String(info.mother));
  const [father, setFather] = useState(String(info.father));
  const ownOf = (side: "mother" | "father") =>
    info.mutations
      .filter((m) => m.side === side)
      .map((m) => `+${m.levels} ${STAT_NAMES_FR[m.stat]}`)
      .join(", ");
  const sides = [
    { id: "mut-mere", label: "Côté mère", value: info.mother, text: mother, set: setMother, own: ownOf("mother") },
    { id: "mut-pere", label: "Côté père", value: info.father, text: father, set: setFather, own: ownOf("father") },
  ];
  const total = info.mother + info.father;
  const changed = mother !== String(creature.mutationsMother) || father !== String(creature.mutationsFather);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Mutations</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {info.mutations.length > 0 && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Mutation repérée d'après ses parents : {info.mutations.map(describeMutation).join(", ")}.
          </p>
        )}
        {info.deduced && (
          <p className="text-sm text-muted-foreground">
            Compteurs calculés d'après ses parents : le fichier d'export indiquait {creature.mutationsMother} côté mère et{" "}
            {creature.mutationsFather} côté père.
          </p>
        )}
        {sides.map((side) => (
          <div key={side.id} className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={side.id}>
                {side.label}
                {side.own && <span className="font-normal text-amber-600 dark:text-amber-400"> · nouvelle : {side.own}</span>}
              </Label>
              <Input
                id={side.id}
                inputMode="numeric"
                value={side.text}
                onChange={(e) => side.set(e.target.value.replace(/\D/g, ""))}
                className="w-20 text-right tabular-nums"
              />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className={cn("h-full", side.value >= MUTATION_LIMIT ? "bg-destructive" : "bg-primary")}
                style={{ width: `${Math.min(100, (side.value / MUTATION_LIMIT) * 100)}%` }}
              />
            </div>
            {side.value >= MUTATION_LIMIT && (
              <p role="alert" className="flex items-center gap-1 text-sm text-destructive">
                <TriangleAlert className="size-4" aria-hidden /> {side.value} mutations : limite de {MUTATION_LIMIT} atteinte de ce côté.
              </p>
            )}
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          {total >= MUTATION_LIMIT
            ? `Total ${total} : ses petits ne recevront plus de mutation venant de lui.`
            : `Total ${total} : encore ${MUTATION_LIMIT - total} avant la limite pour transmettre des mutations.`}
        </p>
        {changed && (
          <Button
            size="sm"
            onClick={() =>
              void onSave(
                { mutationsMother: Number(mother) || 0, mutationsFather: Number(father) || 0 },
                "Compteurs de mutations enregistrés.",
              )
            }
          >
            Enregistrer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ParentsCard(props: {
  creature: Creature;
  candidates: Creature[];
  resolve: ReturnType<typeof createParentResolver<Creature>>;
  /** EF-16: pairs whose stats explain the creature's, when its parents are unknown. */
  suggestions: ParentCandidate[];
  onSave(p: UpdateCreatureRequest, msg: string): Promise<void>;
  onLink(candidate: ParentCandidate): Promise<void>;
}) {
  const { creature, candidates, resolve } = props;
  const nameOf = (id: string) => candidates.find((c) => c.id === id)?.name ?? "?";
  const parents = [
    { key: "motherId", label: "Mère", sex: "female", current: resolve.mother(creature), manual: creature.motherId, exportName: creature.motherName },
    { key: "fatherId", label: "Père", sex: "male", current: resolve.father(creature), manual: creature.fatherId, exportName: creature.fatherName },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Parents</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {props.suggestions.length > 0 && (
          <div className="space-y-2 rounded-md border border-primary/40 bg-primary/10 p-3">
            <p className="text-sm">
              {props.suggestions.length === 1 ? "Parents probables" : "Couples possibles"} d'après ses stats :
            </p>
            <ul className="space-y-1">
              {props.suggestions.slice(0, 5).map((s) => (
                <li key={`${s.motherId}-${s.fatherId}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    ♀ {nameOf(s.motherId)} × ♂ {nameOf(s.fatherId)}
                    {s.mutations.length > 0 && <span className="text-muted-foreground"> · mutation {s.mutations.map(describeMutation).join(", ")}</span>}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => void props.onLink(s)}>
                    Utiliser
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {parents.map((p) => {
          const options = candidates.filter((c) => c.sex === p.sex || c.sex === "unknown");
          const value = p.current?.id ?? NONE;
          return (
            <div key={p.key} className="space-y-1">
              <Label htmlFor={p.key}>{p.label}</Label>
              <Select
                value={value}
                onValueChange={(v) =>
                  void props.onSave({ [p.key]: v === NONE ? null : v }, `${p.label} ${v === NONE ? "retiré(e)" : "enregistré(e)"}.`)
                }
              >
                <SelectTrigger id={p.key} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Inconnu(e)</SelectItem>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (niv. {c.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {p.current && !p.manual && (
                <Badge variant="outline">Reconnu grâce au fichier d'export</Badge>
              )}
              {!p.current && p.exportName && (
                <p className="text-xs text-muted-foreground">
                  D'après l'export : {p.exportName}, pas encore dans la bibliothèque. Importe-le pour compléter l'arbre.
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
