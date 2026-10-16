import {
  breedingTimes,
  cuddleCount,
  cuddlesSoFar,
  formatDuration,
  imprintingGainPerCuddle,
  nextCuddle,
  timerDuration,
  type Timer,
  type TimerKind,
} from "@ark-breeding/core";
import { Bell, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { redirect, useRevalidator } from "react-router";
import { toast } from "sonner";
import { SpeciesPicker } from "~/components/library/species-picker";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ApiError, createTimer, deleteTimer, fetchTimers, fetchTribes } from "~/lib/api";
import { useSpeciesData, type SpeciesData } from "~/lib/species";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/timers";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Minuteurs d'élevage — Ark-breeding" }];
}

export async function clientLoader() {
  try {
    const [timers, tribes] = await Promise.all([fetchTimers(), fetchTribes()]);
    return { timers, tribe: tribes.current };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw redirect("/connexion");
    throw e;
  }
}

const KIND_LABELS: Record<TimerKind, string> = { birth: "Naissance", maturation: "Maturation", mating: "Accouplement" };
/** Timers of the tribe mates show up without reloading the page. */
const REFRESH_MS = 60_000;

const percent = (x: number) => `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

/** Cuddles of a maturation timer at `now`: how many so far, out of how many, and the next one. */
function cuddles(t: Timer, now: number) {
  if (t.kind !== "maturation" || !t.cuddleInterval) return null;
  const start = Date.parse(t.startsAt);
  const end = Date.parse(t.endsAt);
  return {
    done: cuddlesSoFar(start, end, t.cuddleInterval, now),
    total: cuddleCount(start, end, t.cuddleInterval),
    next: nextCuddle(start, end, t.cuddleInterval, now),
  };
}

const at = (ms: number) =>
  new Date(ms).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

/** D-25: breeding timers of the tribe, with the server's breeding multipliers. */
export default function Timers({ loaderData }: Route.ComponentProps) {
  const { timers, tribe } = loaderData;
  const speciesData = useSpeciesData();
  const revalidator = useRevalidator();
  const now = useNow();

  // shared with the tribe: refresh from time to time
  useEffect(() => {
    const id = setInterval(() => void revalidator.revalidate(), REFRESH_MS);
    return () => clearInterval(id);
  }, [revalidator]);

  // imprinting gained per cuddle on the tribe's server (ASB formula)
  const gainOf = (t: Timer) => {
    const species = speciesData?.prepared(t.speciesId, tribe.settings.multipliers);
    return species ? imprintingGainPerCuddle(species) : null;
  };

  // a timer that ends, or a baby that asks for a cuddle, while the page is open: toast, and a
  // system notification if allowed. What happened before the page was opened is not announced.
  const announced = useRef<Set<string> | null>(null);
  announced.current ??= new Set(
    timers.flatMap((t) => {
      const keys = Date.parse(t.endsAt) <= Date.now() ? [t.id] : [];
      const c = cuddles(t, Date.now());
      for (let k = 1; c && k <= c.done; k++) keys.push(`${t.id}:${k}`);
      return keys;
    }),
  );
  useEffect(() => {
    const seen = announced.current!;
    const notify = (message: string) => {
      toast.success(message, { duration: 30_000 });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Ark-breeding", { body: message });
    };
    for (const t of timers) {
      const label = t.name || speciesData?.byId(t.speciesId)?.label || "Minuteur";
      const c = cuddles(t, now);
      if (c && c.done > 0 && !seen.has(`${t.id}:${c.done}`)) {
        seen.add(`${t.id}:${c.done}`);
        const gain = gainOf(t);
        notify(`${label} : câlin d'imprégnation ${c.done} sur ${c.total}${gain ? ` (+${percent(gain)})` : ""}.`);
      }
      if (!seen.has(t.id) && Date.parse(t.endsAt) <= now) {
        seen.add(t.id);
        notify(`${label} : ${KIND_LABELS[t.kind].toLowerCase()} terminée.`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gainOf only reads speciesData and tribe
  }, [now, timers, speciesData, tribe]);

  async function remove(t: Timer) {
    try {
      await deleteTimer(t.id);
      await revalidator.revalidate();
    } catch {
      toast.error("Le minuteur n'a pas pu être supprimé.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Minuteurs d'élevage</h1>
          <p className="text-sm text-muted-foreground">
            {tribe.name} · partagés avec ta tribu · durées aux réglages du serveur
            {tribe.server ? ` « ${tribe.server.name} »` : " de la tribu"}
          </p>
        </div>
        <NotificationButton />
      </div>

      {speciesData ? (
        <NewTimer speciesData={speciesData} settings={tribe.settings} onCreated={() => void revalidator.revalidate()} />
      ) : (
        <p role="status" className="text-muted-foreground">
          Chargement des espèces…
        </p>
      )}

      {timers.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">Aucun minuteur en cours.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" aria-label="Minuteurs">
          {timers.map((t) => {
            const start = Date.parse(t.startsAt);
            const end = Date.parse(t.endsAt);
            const done = now >= end;
            const progress = Math.min(1, Math.max(0, (now - start) / (end - start)));
            const c = cuddles(t, now);
            const gain = c ? gainOf(t) : null;
            const species = speciesData?.byId(t.speciesId)?.label ?? t.speciesId;
            return (
              <li key={t.id}>
                <Card className={cn(done && "opacity-70")}>
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{t.name || species}</p>
                        <p className="text-sm text-muted-foreground">
                          {KIND_LABELS[t.kind]} · {species}
                          {t.createdBy && ` · lancé par ${t.createdBy}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" aria-label={`Supprimer le minuteur ${t.name || species}`} onClick={() => void remove(t)}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <p className={cn("text-lg font-semibold tabular-nums", done && "text-primary")}>
                      {done ? `Terminé ${at(end)}` : `Encore ${formatDuration((end - now) / 1000)}`}
                    </p>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={Math.round(progress * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Avancement"
                    >
                      <div className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {done ? "" : `Fin ${at(end)}`}
                    </p>
                    {c && c.total > 0 && (
                      <p className="text-sm">
                        Câlins : {c.done} sur {c.total}
                        {gain !== null && ` · +${percent(gain)} chacun`}
                        {c.next && ` · prochain ${at(c.next)} (dans ${formatDuration((c.next - now) / 1000)})`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Current time, ticking every second. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function NotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  useEffect(() => setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);
  if (permission !== "default") return null;
  return (
    <Button variant="outline" size="sm" onClick={() => void Notification.requestPermission().then(setPermission)}>
      <Bell className="size-4" aria-hidden /> Me prévenir à la fin
    </Button>
  );
}

function NewTimer({
  speciesData,
  settings,
  onCreated,
}: {
  speciesData: SpeciesData;
  settings: Route.ComponentProps["loaderData"]["tribe"]["settings"];
  onCreated(): void;
}) {
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [kind, setKind] = useState<TimerKind>("birth");
  const [name, setName] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [saving, setSaving] = useState(false);

  // only the species that breed
  const options = useMemo(() => {
    const ids = new Set(speciesData.catalog.map((c) => c.id));
    return speciesData.options.filter((o) => ids.has(o.id));
  }, [speciesData]);
  const raw = speciesId ? speciesData.byId(speciesId)?.raw : undefined;
  const times = raw ? breedingTimes(raw, settings.multipliers) : null;
  const duration = times ? timerDuration(times, kind) : null;
  const elapsedS = Math.max(0, (Number.parseFloat(elapsed.replace(",", ".")) || 0) * 60);
  const birthLabel = times?.birth.kind === "gestation" ? "Gestation" : "Incubation (œuf)";
  const prepared = speciesId ? speciesData.prepared(speciesId, settings.multipliers) : undefined;
  const gain = prepared ? imprintingGainPerCuddle(prepared) : 0;
  const totalCuddles = times ? cuddleCount(0, times.maturation * 1000, times.cuddleInterval) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!speciesId || !times || !duration) return;
    setSaving(true);
    try {
      await createTimer({
        speciesId,
        kind,
        name: name.trim(),
        startsAt: new Date(Date.now() - elapsedS * 1000).toISOString(),
        durationSeconds: duration,
        cuddleInterval: kind === "maturation" ? times.cuddleInterval : null,
      });
      setName("");
      setElapsed("");
      toast.success("Minuteur lancé.");
      onCreated();
    } catch {
      toast.error("Le minuteur n'a pas pu être lancé.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Nouveau minuteur</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="minuteur-espece">Espèce</Label>
            <SpeciesPicker id="minuteur-espece" options={options} value={speciesId} onChange={setSpeciesId} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="minuteur-type">Étape</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as TimerKind)}>
              <SelectTrigger id="minuteur-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="birth">{birthLabel}</SelectItem>
                <SelectItem value="maturation">Maturation (bébé)</SelectItem>
                <SelectItem value="mating">Accouplement (femelle)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="minuteur-nom">Nom (facultatif)</Label>
            <Input id="minuteur-nom" value={name} maxLength={64} onChange={(e) => setName(e.target.value)} placeholder="Œuf de Rex n°3" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="minuteur-ecoule">Déjà écoulé (minutes)</Label>
            <Input id="minuteur-ecoule" inputMode="decimal" value={elapsed} onChange={(e) => setElapsed(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={!duration || saving || elapsedS >= (duration ?? 0)}>
              {saving ? "Lancement…" : "Lancer le minuteur"}
            </Button>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {raw && !times && "Cette espèce ne se reproduit pas."}
              {duration &&
                `Durée : ${formatDuration(duration)}${kind === "mating" && times ? ` (prête entre ${formatDuration(times.matingCooldown[0])} et ${formatDuration(times.matingCooldown[1])})` : ""} · fin ${at(Date.now() + (duration - elapsedS) * 1000)}${kind === "maturation" && times ? ` · un câlin toutes les ${formatDuration(times.cuddleInterval)}, ${totalCuddles} câlin${totalCuddles > 1 ? "s" : ""} à +${percent(gain)}` : ""}`}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
