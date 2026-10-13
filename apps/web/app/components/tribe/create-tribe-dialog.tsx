import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createTribe } from "~/lib/api";

/** EF-03: name of 3 to 40 characters; the creator becomes the owner. */
export function CreateTribeDialog(props: { open: boolean; onOpenChange(open: boolean): void; onCreated(): void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length >= 3 && name.trim().length <= 40;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await createTribe(name.trim());
      setName("");
      props.onOpenChange(false);
      props.onCreated();
    } catch {
      setError("La tribu n'a pas pu être créée. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Créer une tribu</DialogTitle>
            <DialogDescription>
              Tu en seras le propriétaire. Partage ensuite le lien d'invitation à ta tribu en jeu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="nom-tribu">Nom de la tribu</Label>
            <Input id="nom-tribu" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            <p className="text-xs text-muted-foreground">Entre 3 et 40 caractères.</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!valid || busy}>
              {busy ? "Création…" : "Créer la tribu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
