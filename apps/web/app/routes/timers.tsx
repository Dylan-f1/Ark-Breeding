import {
  breedingTimes,
  formatDuration,
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

  // a timer that ends while the page is open: toast, and a system notification if allowed
  const announced = useRef(new Set(timers.filter((t) => Date.parse(t.endsAt) <= Date.now()).map((t) => t.id)));
  useEffect(() => {
    for (const t of timers) {
      if (announced.current.has(t.id) || Date.parse(t.endsAt) > now) continue;
      announced.current.add(t.id);
      const message = `${t.name || speciesData?.byId(t.speciesId)?.label || "Minuteur"} : ${KIND_LABELS[t.kind].toLowerCase()} terminée.`;
      toast.success(message, { duration: 30_000 });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Ark-breeding", { body: message });
    }
  }, [now, timers, speciesData]);

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
            const cuddle = t.kind === "maturation" && t.cuddleInterval ? nextCuddle(start, end, t.cuddleInterval, now) : null;
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
                      {cuddle && ` · prochain câlin ${at(cuddle)} (dans ${formatDuration((cuddle - now) / 1000)})`}
                    </p>
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
                `Durée : ${formatDuration(duration)}${kind === "mating" && times ? ` (prête entre ${formatDuration(times.matingCooldown[0])} et ${formatDuration(times.matingCooldown[1])})` : ""} · fin ${at(Date.now() + (duration - elapsedS) * 1000)}${kind === "maturation" && times ? ` · un câlin toutes les ${formatDuration(times.cuddleInterval)}` : ""}`}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
