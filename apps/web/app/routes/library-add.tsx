import {
  SEX_LABELS,
  STAT_DISPLAY_ORDER,
  STAT_NAMES_FR,
  STATS_COUNT,
  Stat,
  chosenLevels,
  extractCreature,
  isPercentageStat,
  type CreatureInput,
  type CreatureKind,
  type ExtractionIssue,
  type PreparedSpecies,
} from "@ark-breeding/core";
import { useMemo, useState } from "react";
import { Link, redirect, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { SpeciesPicker } from "~/components/library/species-picker";
import { ApiError, fetchTribes, saveCreatures } from "~/lib/api";
import { useSpeciesData } from "~/lib/species";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/library-add";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Ajouter une créature — Ark-breeding" }];
}

export async function clientLoader() {
  try {
    return { tribe: (await fetchTribes()).current };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw redirect("/connexion");
    throw e;
  }
}

const percent = (x: number) => `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

const KIND_LABELS: Record<CreatureKind, string> = { wild: "Sauvage", tamed: "Apprivoisé", bred: "Élevé" };

const ISSUE_MESSAGES: Record<ExtractionIssue, string> = {
  "total-level": "Le niveau ne correspond pas aux stats : vérifie le niveau et la torpeur.",
  "taming-effectiveness": "L'efficacité d'apprivoisement indiquée ne colle pas : laisse-la vide si tu ne la connais pas.",
  "no-result": "Aucune combinaison de niveaux ne colle : vérifie les valeurs signalées.",
  "max-wild-level": "Ce niveau dépasse le niveau sauvage maximum du serveur (réglages de la tribu).",
};

/** "4 520,5" or "4520.5" → 4520.5; empty → null */
function parseNumber(text: string): number | null {
  const n = Number.parseFloat(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Stats the game shows in the inventory for this species (+ torpidity, needed for the extraction). */
function inputStats(species: PreparedSpecies): number[] {
  return STAT_DISPLAY_ORDER.filter((s) => species.usesStat(s) && (species.displaysStat(s) || s === Stat.Torpidity));
}

export default function LibraryAdd({ loaderData }: Route.ComponentProps) {
  const { settings } = loaderData.tribe;
  const speciesData = useSpeciesData();
  const navigate = useNavigate();
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [kind, setKind] = useState<CreatureKind>("tamed");
  const [level, setLevel] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [imprinting, setImprinting] = useState("");
  const [te, setTe] = useState("");
  const [name, setName] = useState("");
  const [sex, setSex] = useState<"male" | "female">("female");
  const [saving, setSaving] = useState(false);

  const species = speciesId ? speciesData?.prepared(speciesId, settings.multipliers) : undefined;
  const stats = species ? inputStats(species) : [];

  // EF-08: extraction runs on every keystroke (well under a millisecond)
  const extraction = useMemo(() => {
    const lvl = parseNumber(level);
    if (!species || !lvl || lvl < 1) return null;
    const statValues = Array<number>(STATS_COUNT).fill(0);
    for (const s of stats) {
      const v = parseNumber(values[s] ?? "");
      if (v === null) return null;
      statValues[s] = isPercentageStat(s) ? v / 100 : v;
    }
    const teValue = parseNumber(te);
    return {
      statValues,
      result: extractCreature({
        species,
        level: Math.trunc(lvl),
        statValues,
        kind,
        maxWildLevel: settings.maxWildLevel,
        imprintingBonus: kind === "bred" ? (parseNumber(imprinting) ?? 0) / 100 : 0,
        tamingEffectiveness:
          kind === "tamed" && teValue !== null
            ? { min: Math.max(0, teValue / 100 - 0.025), max: Math.min(1, teValue / 100 + 0.025) }
            : undefined,
      }),
    };
  }, [species, stats, level, values, kind, imprinting, te, settings.maxWildLevel]);

  const result = extraction?.result;
  const levels = result?.valid ? chosenLevels(result) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!species || !speciesId || !result?.valid || !levels || !extraction) return;
    const creature: CreatureInput = {
      speciesId,
      name: name.trim() || species.name,
      sex: species.raw.noGender ? "unknown" : sex,
      status: "available",
      kind: result.kind,
      level: Math.trunc(parseNumber(level)!),
      ...levels,
      statValues: extraction.statValues,
      tamingEffectiveness: result.kind === "tamed" && result.tamingEffectiveness >= 0 ? Math.min(1, result.tamingEffectiveness) : null,
      imprintingBonus: result.kind === "bred" ? result.imprintingBonus : 0,
      mutationsMother: 0,
      mutationsFather: 0,
      colors: [0, 0, 0, 0, 0, 0],
      neutered: false,
      arkId: null,
      motherArkId: null,
      fatherArkId: null,
      motherName: null,
      fatherName: null,
      extractionUnique: result.unique,
    };
    setSaving(true);
    try {
      await saveCreatures([creature]);
      toast.success(`${creature.name} a été ajouté à la bibliothèque.`);
      navigate("/bibliotheque");
    } catch {
      toast.error("L'enregistrement a échoué. Réessaie dans un instant.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ajouter une créature</h1>
        <p className="text-sm text-muted-foreground">
          Recopie les valeurs affichées dans l'inventaire du dino. Les niveaux se calculent pendant que tu tapes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="espece">Espèce</Label>
          {speciesData ? (
            <SpeciesPicker id="espece" options={speciesData.options} value={speciesId} onChange={setSpeciesId} />
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              Chargement des espèces…
            </p>
          )}
        </div>

        <fieldset className="space-y-1 sm:col-span-2">
          <legend className="text-sm font-medium">Origine</legend>
          <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(v) => v && setKind(v as CreatureKind)}>
            {(Object.keys(KIND_LABELS) as CreatureKind[]).map((k) => (
              <ToggleGroupItem key={k} value={k}>
                {KIND_LABELS[k]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </fieldset>

        <Field id="niveau" label="Niveau" value={level} onChange={setLevel} />
        {kind === "bred" && <Field id="impregnation" label="Imprégnation (%)" value={imprinting} onChange={setImprinting} />}
        {kind === "tamed" && (
          <Field id="te" label="Efficacité d'apprivoisement (%, facultatif)" value={te} onChange={setTe} />
        )}
      </div>

      {species && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Stats affichées en jeu</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.map((s) => {
              const r = result?.results[s];
              const choice = r?.[result!.chosen[s]!];
              const failed = !!result && !result.valid && result.failedStats.includes(s);
              return (
                <div key={s} className="grid grid-cols-[1fr_8rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_8rem_1fr]">
                  <Label htmlFor={`stat-${s}`}>
                    {STAT_NAMES_FR[s]}
                    {isPercentageStat(s) ? " (%)" : ""}
                  </Label>
                  <Input
                    id={`stat-${s}`}
                    inputMode="decimal"
                    value={values[s] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [s]: e.target.value }))}
                    aria-invalid={failed || undefined}
                    aria-describedby={`niveaux-${s}`}
                    className="text-right tabular-nums"
                  />
                  <p id={`niveaux-${s}`} className={cn("col-span-2 text-sm sm:col-span-1", failed ? "text-destructive" : "text-muted-foreground")}>
                    {failed
                      ? "Valeur impossible"
                      : choice && result?.valid
                        ? choice.levelWild < 0
                          ? "—"
                          : `Sauvage ${choice.levelWild + choice.levelMut}${choice.levelDom ? ` · Domestique ${choice.levelDom}` : ""}${r!.length > 1 ? ` (${r!.length} possibilités)` : ""}`
                        : ""}
                  </p>
                </div>
              );
            })}
            <div aria-live="polite" className="pt-2 text-sm">
              {result && !result.valid && (
                <p className="text-destructive">{result.issues.map((i) => ISSUE_MESSAGES[i]).join(" ")}</p>
              )}
              {result?.valid && (
                <p className="text-primary">
                  Niveaux trouvés{result.unique ? "." : " — plusieurs combinaisons possibles, la plus probable est retenue."}
                  {result.kind === "tamed" && result.tamingEffectiveness >= 0 &&
                    ` Efficacité d'apprivoisement : ${percent(result.tamingEffectiveness)}.`}
                  {result.kind === "bred" && ` Imprégnation : ${percent(result.imprintingBonus)}.`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {species && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="nom" label="Nom (facultatif)" value={name} onChange={setName} inputMode="text" />
          {!species.raw.noGender && (
            <div className="space-y-1">
              <Label htmlFor="sexe">Sexe</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as "male" | "female")}>
                <SelectTrigger id="sexe" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">{SEX_LABELS.female}</SelectItem>
                  <SelectItem value="male">{SEX_LABELS.male}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={!result?.valid || saving}>
          {saving ? "Enregistrement…" : "Ajouter à la bibliothèque"}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/bibliotheque">Annuler</Link>
        </Button>
      </div>
    </form>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange(v: string): void;
  inputMode?: "decimal" | "text";
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        inputMode={props.inputMode ?? "decimal"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
