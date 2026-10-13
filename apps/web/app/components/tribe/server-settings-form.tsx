import {
  OFFICIAL_SERVER_SETTINGS,
  STAT_DISPLAY_ORDER,
  STAT_NAMES_FR,
  isOfficialSettings,
  parseServerIni,
  serverSettingsSchema,
  type ServerSettings,
  type SharedServer,
  type StatMultipliers,
  type TribeDetail,
} from "@ark-breeding/core";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  ApiError,
  deleteServer,
  fetchServers,
  followServer,
  publishServer,
  saveServerSettings,
  updateServer,
} from "~/lib/api";
import { applySettingsToLibrary, recomputeSummary } from "~/lib/recompute";
import { cn } from "~/lib/utils";

const MULTIPLIER_COLUMNS = [
  { label: "Bonus d'apprivoisement (ajout)", ini: "DinoTamed_Add" },
  { label: "Bonus d'apprivoisement (mult.)", ini: "DinoTamed_Affinity" },
  { label: "Par niveau domestique", ini: "DinoTamed" },
  { label: "Par niveau sauvage", ini: "DinoWild" },
] as const;

const NUMBER_FIELDS = [
  { key: "babyImprintingStatScaleMultiplier", label: "Effet de l'imprégnation", ini: "BabyImprintingStatScaleMultiplier" },
  { key: "babyMatureSpeedMultiplier", label: "Vitesse de maturation", ini: "BabyMatureSpeedMultiplier" },
  { key: "babyCuddleIntervalMultiplier", label: "Intervalle des câlins", ini: "BabyCuddleIntervalMultiplier" },
  { key: "babyImprintAmountMultiplier", label: "Gain d'imprégnation", ini: "BabyImprintAmountMultiplier" },
  { key: "eggHatchSpeedMultiplier", label: "Vitesse d'éclosion", ini: "EggHatchSpeedMultiplier" },
  { key: "matingIntervalMultiplier", label: "Intervalle d'accouplement", ini: "MatingIntervalMultiplier" },
] as const;

const toText = (n: number) => String(n).replace(".", ",");
const parse = (t: string) => Number.parseFloat(t.replace(",", "."));

type Mode = "official" | "shared" | "custom";

/**
 * EF-05 / EF-27 / EF-28: official preset, a server shared by another player, or the tribe's own
 * values (typed or pasted from the ini files, and publishable for others). Any change recomputes
 * the levels of the library.
 */
export function ServerSettingsForm({ tribe, onSaved }: { tribe: TribeDetail; onSaved(): void }) {
  const initialMode: Mode = tribe.server ? "shared" : isOfficialSettings(tribe.settings) ? "official" : "custom";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [draft, setDraft] = useState<ServerSettings>(structuredClone(tribe.settings));
  /** Set when the custom editor edits one of my shared servers instead of the tribe's settings. */
  const [editingServer, setEditingServer] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, settings: ServerSettings, success: string) {
    setBusy(true);
    try {
      await action();
      const summary = await applySettingsToLibrary(settings);
      toast.success(success, { description: recomputeSummary(summary), duration: summary.failed.length ? 15_000 : undefined });
      setEditingServer(null);
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === "name_taken" ? "Ce nom de serveur est déjà pris." : "L'enregistrement a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        variant="outline"
        value={mode}
        onValueChange={(v) => {
          if (!v) return;
          setMode(v as Mode);
          setEditingServer(null);
        }}
        className="flex-wrap"
      >
        <ToggleGroupItem value="official">Serveur officiel</ToggleGroupItem>
        <ToggleGroupItem value="shared">Serveur partagé</ToggleGroupItem>
        <ToggleGroupItem value="custom">Réglages personnalisés</ToggleGroupItem>
      </ToggleGroup>

      {mode === "official" && (
        <Button
          type="button"
          disabled={busy || (!tribe.server && isOfficialSettings(tribe.settings))}
          onClick={() => void run(() => saveServerSettings(OFFICIAL_SERVER_SETTINGS), OFFICIAL_SERVER_SETTINGS, "Réglages officiels enregistrés.")}
        >
          {busy ? "Enregistrement et recalcul…" : "Utiliser les réglages officiels"}
        </Button>
      )}

      {mode === "shared" && (
        <SharedServerPicker
          tribe={tribe}
          busy={busy}
          onFollow={(s) => void run(() => followServer(s.id), s.settings, `Ta tribu suit maintenant « ${s.name} ».`)}
          onEdit={(s) => {
            setDraft(structuredClone(s.settings));
            setEditingServer({ id: s.id, name: s.name });
            setMode("custom");
          }}
          onRemove={(s) =>
            window.confirm(`Retirer « ${s.name} » de la liste ? Les tribus qui le suivent gardent une copie de ses réglages.`) &&
            void run(() => deleteServer(s.id), tribe.settings, `« ${s.name} » a été retiré.`)
          }
        />
      )}

      {mode === "custom" && (
        <div className="space-y-6">
          {editingServer && (
            <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
              Tu modifies le serveur partagé <strong>« {editingServer.name} »</strong> : toutes les tribus qui le suivent
              recevront ces réglages.
            </p>
          )}
          <SettingsEditor draft={draft} setDraft={setDraft} />
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={busy || !serverSettingsSchema.safeParse(draft).success}
              onClick={() =>
                editingServer
                  ? void run(() => updateServer(editingServer.id, { settings: draft }), draft, `Serveur « ${editingServer.name} » mis à jour.`)
                  : void run(() => saveServerSettings(draft), draft, "Réglages enregistrés.")
              }
            >
              {busy
                ? "Enregistrement et recalcul…"
                : editingServer
                  ? `Enregistrer le serveur « ${editingServer.name} »`
                  : "Enregistrer pour ma tribu"}
            </Button>
          </div>
          {!editingServer && (
            <PublishServer
              disabled={busy || !serverSettingsSchema.safeParse(draft).success}
              onPublish={(name) =>
                void run(
                  async () => {
                    const { id } = await publishServer(name, draft);
                    await followServer(id);
                  },
                  draft,
                  `« ${name} » est publié : les autres joueurs peuvent le choisir.`,
                )
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function SharedServerPicker(props: {
  tribe: TribeDetail;
  busy: boolean;
  onFollow(s: SharedServer): void;
  onEdit(s: SharedServer): void;
  onRemove(s: SharedServer): void;
}) {
  const [servers, setServers] = useState<SharedServer[] | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    fetchServers()
      .then(setServers)
      .catch(() => setServers([]));
  }, [props.tribe.server?.id]);

  if (!servers) return <p role="status" className="text-sm text-muted-foreground">Chargement des serveurs…</p>;
  const q = query.trim().toLocaleLowerCase("fr");
  const shown = servers.filter((s) => !q || s.name.toLocaleLowerCase("fr").includes(q));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Les réglages publiés par l'admin d'un serveur. Si le serveur change ses réglages, ta tribu suit automatiquement.
      </p>
      <Input type="search" placeholder="Rechercher un serveur…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher un serveur" />
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {servers.length ? "Aucun serveur ne correspond." : "Aucun serveur partagé pour l'instant. Publie le tien depuis « Réglages personnalisés »."}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {shown.map((s) => {
            const current = props.tribe.server?.id === s.id;
            return (
              <li key={s.id} className={cn("flex flex-wrap items-center gap-3 p-3", current && "bg-primary/10")}>
                <div className="min-w-40 flex-1">
                  <p className="font-medium">
                    {s.name}
                    {current && <span className="text-sm font-normal text-primary"> · suivi par ta tribu</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.isMine ? "Publié par toi" : `Publié par ${s.ownerName ?? "un ancien joueur"}`} · {s.tribeCount} tribu
                    {s.tribeCount > 1 ? "s" : ""} · niveau sauvage max {s.settings.maxWildLevel}
                  </p>
                </div>
                {!current && (
                  <Button size="sm" disabled={props.busy} onClick={() => props.onFollow(s)}>
                    Utiliser
                  </Button>
                )}
                {s.isMine && (
                  <>
                    <Button size="sm" variant="outline" disabled={props.busy} onClick={() => props.onEdit(s)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="ghost" disabled={props.busy} onClick={() => props.onRemove(s)}>
                      Retirer
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PublishServer({ disabled, onPublish }: { disabled: boolean; onPublish(name: string): void }) {
  const [name, setName] = useState("");
  const valid = name.trim().length >= 3 && name.trim().length <= 60;
  return (
    <form
      className="space-y-2 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onPublish(name.trim());
      }}
    >
      <Label htmlFor="nom-serveur">Tu es admin d'un serveur ? Publie ces réglages sous son nom</Label>
      <p className="text-xs text-muted-foreground">
        Les autres joueurs le choisiront dans « Serveur partagé » sans rien coller. Toi seul pourras le modifier.
      </p>
      <div className="flex gap-2">
        <Input id="nom-serveur" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="ex. Les ailes Faucheuses PvE #1" />
        <Button type="submit" variant="outline" disabled={disabled || !valid}>
          Publier
        </Button>
      </div>
    </form>
  );
}

function SettingsEditor({ draft, setDraft }: { draft: ServerSettings; setDraft: React.Dispatch<React.SetStateAction<ServerSettings>> }) {
  const [ini, setIni] = useState("");
  const valid = serverSettingsSchema.safeParse(draft).success;

  function setStat(stat: number, column: number, text: string) {
    setDraft((d) => {
      const next = structuredClone(d);
      const row: StatMultipliers = [...(next.multipliers.statMultipliers[stat] ?? [1, 1, 1, 1])];
      row[column] = parse(text);
      next.multipliers.statMultipliers[stat] = row;
      return next;
    });
  }

  function readIni() {
    const { settings: parsed, recognized } = parseServerIni(ini);
    if (!recognized.length) {
      toast.error("Aucun réglage d'élevage reconnu dans ce texte.");
      return;
    }
    setDraft(parsed);
    toast.success(`${recognized.length} réglage(s) lu(s). Vérifie puis enregistre.`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="ini">Colle les lignes de ton Game.ini et de ton GameUserSettings.ini</Label>
        <textarea
          id="ini"
          value={ini}
          onChange={(e) => setIni(e.target.value)}
          rows={5}
          placeholder={"PerLevelStatsMultiplier_DinoTamed[0]=0.2\nBabyImprintingStatScaleMultiplier=1.0\nOverrideOfficialDifficulty=5.0"}
          className="w-full rounded-md border bg-transparent p-3 font-mono text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={readIni} disabled={!ini.trim()}>
          Lire les réglages
        </Button>
        <p className="text-xs text-muted-foreground">Les réglages absents gardent leur valeur officielle, comme sur le serveur.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="max-wild">Niveau sauvage maximum</Label>
          <Input
            id="max-wild"
            inputMode="numeric"
            value={String(draft.maxWildLevel)}
            onChange={(e) => setDraft((d) => ({ ...d, maxWildLevel: Number.parseInt(e.target.value, 10) || 0 }))}
          />
        </div>
        {NUMBER_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={f.key} title={f.ini}>
              {f.label}
            </Label>
            <Input
              id={f.key}
              inputMode="decimal"
              defaultValue={toText(draft.multipliers[f.key])}
              key={`${f.key}-${draft.multipliers[f.key]}`}
              onBlur={(e) => setDraft((d) => ({ ...d, multipliers: { ...d.multipliers, [f.key]: parse(e.target.value) } }))}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        {(
          [
            ["allowSpeedLeveling", "Monter la vitesse (AllowSpeedLeveling)"],
            ["allowFlyerSpeedLeveling", "Monter la vitesse des volants (AllowFlyerSpeedLeveling)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.multipliers[key]}
              onChange={(e) => setDraft((d) => ({ ...d, multipliers: { ...d.multipliers, [key]: e.target.checked } }))}
              className="size-4 accent-(--primary)"
            />
            {label}
          </label>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stat</TableHead>
              {MULTIPLIER_COLUMNS.map((c) => (
                <TableHead key={c.ini} className="text-right" title={`PerLevelStatsMultiplier_${c.ini}`}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {STAT_DISPLAY_ORDER.map((s) => (
              <TableRow key={s}>
                <TableCell>{STAT_NAMES_FR[s]}</TableCell>
                {MULTIPLIER_COLUMNS.map((col, i) => {
                  const value = draft.multipliers.statMultipliers[s]?.[i] ?? 1;
                  return (
                    <TableCell key={col.ini} className="text-right">
                      <Input
                        aria-label={`${STAT_NAMES_FR[s]} — ${col.label}`}
                        inputMode="decimal"
                        defaultValue={toText(value)}
                        key={`${s}-${i}-${value}`}
                        onBlur={(e) => setStat(s, i, e.target.value)}
                        className="ml-auto w-24 text-right tabular-nums"
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!valid && <p className="text-sm text-destructive">Une valeur est invalide (nombre positif attendu).</p>}
    </div>
  );
}
