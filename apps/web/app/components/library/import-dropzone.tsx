import { FileUp } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { saveCreatures } from "~/lib/api";
import { readExportFiles, type ImportFailure } from "~/lib/import-exports";
import { cn } from "~/lib/utils";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** EF-06: drop the game's export files (.ini) to add or refresh creatures. */
export function ImportDropzone({ onImported }: { onImported: () => void }) {
  const inputId = useId();
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
      const result = await readExportFiles(files);
      setFailures(result.failures);
      if (result.creatures.length) {
        const saved = await saveCreatures(result.creatures);
        const parts = [
          saved.created && plural(saved.created, "créature ajoutée"),
          saved.updated && plural(saved.updated, "créature mise à jour"),
        ].filter(Boolean);
        toast.success(parts.join(", "), {
          description: result.ambiguous.length
            ? `Plusieurs combinaisons de niveaux possibles pour : ${result.ambiguous.join(", ")}.`
            : undefined,
        });
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

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void importFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <FileUp className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Glisse ici tes fichiers d'export <span className="font-mono">.ini</span> (dossier{" "}
          <span className="font-mono">ShooterGame\Saved\DinoExports</span>)
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".ini"
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && void importFiles(e.target.files)}
        />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
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
    </div>
  );
}
