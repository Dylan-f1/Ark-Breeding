import {
  OFFICIAL_SERVER_SETTINGS,
  STAT_DISPLAY_ORDER,
  STAT_NAMES_FR,
  isOfficialSettings,
  parseServerIni,
  serverSettingsSchema,
  type ServerSettings,
  type StatMultipliers,
} from "@ark-breeding/core";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { fetchLibrary, saveRecomputedLevels, saveServerSettings } from "~/lib/api";
import { recomputeLevels } from "~/lib/recompute";

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

/** EF-05: official preset, or the server's own values (typed or pasted from its ini files). */
export function ServerSettingsForm({ settings, onSaved }: { settings: ServerSettings; onSaved(): void }) {
  const [mode, setMode] = useState<"official" | "custom">(isOfficialSettings(settings) ? "official" : "custom");
  const [draft, setDraft] = useState<ServerSettings>(structuredClone(settings));
  const [ini, setIni] = useState("");
  const [busy, setBusy] = useState(false);

  const effective = mode === "official" ? OFFICIAL_SERVER_SETTINGS : draft;
  const valid = serverSettingsSchema.safeParse(effective).success;
  const changed = JSON.stringify(effective) !== JSON.stringify(settings);

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

  async function save() {
    setBusy(true);
    try {
      await saveServerSettings(effective);
      // levels depend on the multipliers: recompute the library with the new ones
      const { creatures } = await fetchLibrary();
      const { updates, failed } = await recomputeLevels(creatures, effective);
      if (updates.length) await saveRecomputedLevels(updates);
      toast.success("Réglages enregistrés.", {
        description: creatures.length
          ? `Niveaux recalculés pour ${updates.length} créature(s).${failed.length ? ` ${failed.length} n'ont pas pu l'être (valeurs incompatibles avec ces réglages) : ${failed.slice(0, 5).map((c) => c.name).join(", ")}${failed.length > 5 ? "…" : "."}` : ""}`
          : undefined,
        duration: failed.length ? 15_000 : undefined,
      });
      onSaved();
    } catch {
      toast.error("Les réglages n'ont pas pu être enregistrés.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ToggleGroup type="single" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as typeof mode)}>
        <ToggleGroupItem value="official">Serveur officiel</ToggleGroupItem>
        <ToggleGroupItem value="custom">Réglages personnalisés</ToggleGroupItem>
      </ToggleGroup>

      {mode === "custom" && (
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
                  onBlur={(e) =>
                    setDraft((d) => ({ ...d, multipliers: { ...d.multipliers, [f.key]: parse(e.target.value) } }))
                  }
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
        </div>
      )}

      {!valid && <p className="text-sm text-destructive">Une valeur est invalide (nombre positif attendu).</p>}
      <Button type="button" onClick={() => void save()} disabled={!valid || !changed || busy}>
        {busy ? "Enregistrement et recalcul…" : "Enregistrer les réglages"}
      </Button>
    </div>
  );
}
