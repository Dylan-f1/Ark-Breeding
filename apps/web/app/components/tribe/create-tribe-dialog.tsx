import type { SharedServer } from "@ark-breeding/core";
import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { createTribe, fetchServers, followServer } from "~/lib/api";

const OWN_SETTINGS = "own";

/**
 * EF-03: name of 3 to 40 characters; the creator becomes the owner. One tribe per server a player
 * plays on (D-37): the shared server can be chosen right away, its settings then apply (EF-27).
 */
export function CreateTribeDialog(props: { open: boolean; onOpenChange(open: boolean): void; onCreated(): void }) {
  const [name, setName] = useState("");
  const [serverId, setServerId] = useState(OWN_SETTINGS);
  const [servers, setServers] = useState<SharedServer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length >= 3 && name.trim().length <= 40;

  useEffect(() => {
    if (!props.open || servers) return;
    fetchServers()
      .then(setServers)
      .catch(() => setServers([]));
  }, [props.open, servers]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      // the new tribe becomes the current one: following the server applies to it
      await createTribe(name.trim());
      if (serverId !== OWN_SETTINGS) await followServer(serverId);
      setName("");
      setServerId(OWN_SETTINGS);
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
              Tu en seras le propriétaire. Une tribu par serveur où tu joues : chacune a ses réglages, sa bibliothèque et ses
              minuteurs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="nom-tribu">Nom de la tribu</Label>
            <Input id="nom-tribu" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            <p className="text-xs text-muted-foreground">Entre 3 et 40 caractères.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="serveur-tribu">Serveur</Label>
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger id="serveur-tribu" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={OWN_SETTINGS}>Je règle les taux plus tard</SelectItem>
                {servers?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.ownerName ? ` (publié par ${s.ownerName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {servers && servers.length === 0
                ? "Aucun serveur partagé pour l'instant : tu pourras saisir ses taux dans la page Tribu."
                : "Ton serveur n'est pas dans la liste ? Saisis ses taux ensuite dans la page Tribu."}
            </p>
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
