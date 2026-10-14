import type { ServerSettings } from "@ark-breeding/core";
import { FileUp, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { saveCreatures } from "~/lib/api";
import { connectFolder, folderSupported, forgetFolder, markImported, readNewExports, savedFolder } from "~/lib/export-folder";
import { readExportFiles, type ImportFailure } from "~/lib/import-exports";
import { linkParentsInLibrary, mutationSummary } from "~/lib/parents";
import { cn } from "~/lib/utils";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");

type Folder = Awaited<ReturnType<typeof savedFolder>>;

/**
 * EF-06: drop the game's export files (.ini) anywhere on the page to add or refresh creatures.
 * EF-07: on Chrome and Edge, the DinoExports folder can be connected once and re-read in one click.
 */
export function ImportDropzone({ settings, onImported }: { settings: ServerSettings; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const [folder, setFolder] = useState<Folder>();
  const [canConnect, setCanConnect] = useState(false);

  useEffect(() => {
    setCanConnect(folderSupported());
    void savedFolder().then(setFolder);
  }, []);

  /** Imports the files; true when every file went in. */
  async function importFiles(fileList: FileList | File[]): Promise<boolean> {
    const files = [...fileList].filter((f) => f.name.toLowerCase().endsWith(".ini"));
    if (!files.length) {
      toast.error("Aucun fichier .ini : exporte un dino en jeu, puis dépose le fichier de DinoExports.");
      return false;
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
      return result.failures.length === 0;
    } catch {
      toast.error("L'import a échoué. Réessaie dans un instant.");
      return false;
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

  async function connect() {
    try {
      const connected = await connectFolder();
      setFolder(connected);
      await importFolder(connected);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error("Le navigateur n'a pas pu ouvrir ce dossier.", {
        description: "S'il est dans « Program Files », Chrome le refuse : choisis tes fichiers ou glisse-les sur la page.",
      });
    }
  }

  async function importFolder(target = folder) {
    if (!target) return;
    try {
      const files = await readNewExports(target);
      if (files === null) {
        toast.error("Sans autorisation de lecture, le dossier ne peut pas être importé.");
        return;
      }
      if (!files.length) {
        toast.info("Aucun nouvel export depuis le dernier import.", {
          description: "Exporte tes dinos en jeu (fiche de la créature → Exporter), puis réessaie.",
        });
        return;
      }
      // files that failed (wrong server settings…) are read again next time
      if (await importFiles(files)) await markImported(target, files);
    } catch {
      toast.error("Le dossier n'est plus accessible : connecte-le à nouveau.");
      await forgetFolder().catch(() => undefined);
      setFolder(undefined);
    }
  }

  async function disconnect() {
    await forgetFolder().catch(() => undefined);
    setFolder(undefined);
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
          Glisse tes fichiers d'export <span className="font-mono">.ini</span> n'importe où sur la page (dossier{" "}
          <span className="font-mono">ShooterGame\Saved\DinoExports</span>)
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
        <div className="flex flex-wrap justify-center gap-2">
          {folder ? (
            <Button size="sm" disabled={busy} onClick={() => void importFolder()}>
              <FolderOpen className="size-4" aria-hidden />
              {busy ? "Import en cours…" : "Importer les nouveaux exports"}
            </Button>
          ) : (
            canConnect && (
              <Button size="sm" disabled={busy} onClick={() => void connect()}>
                <FolderOpen className="size-4" aria-hidden /> Connecter mon dossier DinoExports
              </Button>
            )
          )}
          <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy && !folder ? "Import en cours…" : "Choisir des fichiers"}
          </Button>
        </div>
        {folder && (
          <p className="text-xs text-muted-foreground">
            Dossier connecté : <span className="font-mono">{folder.handle.name}</span> ·{" "}
            <button type="button" className="underline underline-offset-2" onClick={() => void disconnect()}>
              déconnecter
            </button>
          </p>
        )}
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
