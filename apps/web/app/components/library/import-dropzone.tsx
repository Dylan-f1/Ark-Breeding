import type { ServerSettings } from "@ark-breeding/core";
import { Copy, FileUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { saveCreatures } from "~/lib/api";
import { readExportFiles, type ImportFailure } from "~/lib/import-exports";
import { linkParentsInLibrary, mutationSummary } from "~/lib/parents";
import { cn } from "~/lib/utils";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");

/**
 * Where Steam installs ASA by default. A site cannot open a given folder, and Chrome refuses to
 * connect one under Program Files (D-22): the path is copied, the file picker then remembers it.
 */
const STEAM_EXPORTS = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\ARK Survival Ascended\\ShooterGame\\Saved\\DinoExports";
const PICKER_TIP =
  "Dans la fenêtre « Choisir des fichiers », colle le chemin dans la barre d'adresse : la fois suivante, elle s'ouvrira directement dans ce dossier.";

/** EF-06 / EF-07: drop the game's export files (.ini) anywhere on the page, or pick them. */
export function ImportDropzone({ settings, onImported }: { settings: ServerSettings; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<ImportFailure[]>([]);

  async function importFiles(fileList: FileList | File[]) {
    const files = [...fileList].filter((f) => f.name.toLowerCase().endsWith(".ini"));
    if (!files.length) {
      toast.error("Aucun fichier .ini : exporte un dino en jeu, puis dépose le fichier de DinoExports.");
      return;
    }
    setBusy(true);
    setFailures([]);
    try {
      const result = await readExportFiles(files, settings);
      setFailures(result.failures);
      if (result.creatures.length) {
        const saved = await saveCreatures(result.creatures);
        const parts = [
          saved.created && plural(saved.created, "créature ajoutée"),
          saved.updated && plural(saved.updated, "créature mise à jour"),
        ].filter(Boolean);
        // EF-16: ASA exports often carry no ancestry, the genetics tell the parents apart
        const links = await linkParentsInLibrary(settings).catch(() => ({ linked: 0, mutations: [] }));
        const notes = [
          links.linked && `Parents reconnus pour ${plural(links.linked, "créature")}.`,
          mutationSummary(links),
          result.ambiguous.length && `Plusieurs combinaisons de niveaux possibles pour : ${result.ambiguous.join(", ")}.`,
        ].filter(Boolean);
        toast.success(parts.join(", "), { description: notes.length ? notes.join(" ") : undefined, duration: 10_000 });
        onImported();
      }
      if (result.failures.length) toast.error(`${plural(result.failures.length, "fichier")} non importé(s).`);
    } catch {
      toast.error("L'import a échoué. Réessaie dans un instant.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // the whole page takes the drop: no need to aim at the zone, and a missed drop never opens the file
  const importRef = useRef(importFiles);
  importRef.current = importFiles;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (hasFiles(e) && --depth <= 0) {
        depth = 0;
        setDragging(false);
      }
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (!busyRef.current && e.dataTransfer) void importRef.current(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(STEAM_EXPORTS);
      toast.success("Chemin copié.", { description: PICKER_TIP, duration: 10_000 });
    } catch {
      toast.error("La copie a échoué : sélectionne le chemin à la main.");
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <FileUp className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Glisse tes fichiers d'export <span className="font-mono">.ini</span> n'importe où sur la page, ou choisis-les.
        </p>
        <p className="flex max-w-full flex-wrap items-center justify-center gap-x-2 text-xs text-muted-foreground">
          <span>Dossier par défaut (Steam) :</span>
          <span className="font-mono break-all select-all">{STEAM_EXPORTS}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void copyPath()}>
            <Copy className="size-3.5" aria-hidden /> Copier
          </Button>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".ini"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => e.target.files && void importFiles(e.target.files)}
        />
        <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Import en cours…" : "Choisir des fichiers"}
        </Button>
      </div>
      {failures.length > 0 && (
        <ul className="space-y-1 text-sm text-destructive" aria-label="Fichiers non importés">
          {failures.map((f) => (
            <li key={f.file}>
              <span className="font-mono">{f.file}</span> : {f.reason}
            </li>
          ))}
        </ul>
      )}
      {dragging && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          aria-hidden
        >
          <div className="rounded-xl border-2 border-dashed border-primary bg-background px-10 py-8 text-center">
            <FileUp className="mx-auto mb-2 size-10 text-primary" />
            <p className="font-medium">Dépose tes exports pour les importer</p>
          </div>
        </div>
      )}
    </div>
  );
}
