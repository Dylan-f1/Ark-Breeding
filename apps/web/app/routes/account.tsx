import { ACCOUNT_DELETION_WORD } from "@ark-breeding/core";
import { useState } from "react";
import { Link, redirect, useNavigate, useRevalidator } from "react-router";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { deleteAccount, fetchCurrentUser, fetchTribes } from "~/lib/api";
import type { Route } from "./+types/account";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Mon compte — Ark-breeding" }];
}

export async function clientLoader() {
  const user = await fetchCurrentUser();
  if (!user) throw redirect("/connexion");
  return { user, tribes: (await fetchTribes()).tribes };
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const { user, tribes } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const owned = tribes.filter((t) => t.isOwner);

  // EF-20
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await deleteAccount();
      toast.success("Ton compte a été supprimé.");
      await revalidator.revalidate();
      navigate("/");
    } catch {
      toast.error("La suppression a échoué. Réessaie.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Mon compte</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Profil</h2>
          </CardTitle>
          <CardDescription>Pseudo et avatar viennent de Discord et se mettent à jour à chaque connexion.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Avatar className="size-10">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user.displayName}</p>
            <p className="text-sm text-muted-foreground">
              Membre de {tribes.length} tribu{tribes.length > 1 ? "s" : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>
            <h2>Supprimer mon compte</h2>
          </CardTitle>
          <CardDescription>Effacement immédiat et définitif de ton compte, de ta session et de ton lien avec Discord.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={remove} className="space-y-3">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {owned.map((t) => (
                <li key={t.id}>
                  « {t.name} » : passe au plus ancien autre membre, ou est supprimée avec sa bibliothèque si tu es seul.
                </li>
              ))}
              <li>Les créatures que tu as ajoutées aux autres tribus y restent.</li>
            </ul>
            <div className="space-y-1">
              <Label htmlFor="confirmer-suppression">Tape « {ACCOUNT_DELETION_WORD} » pour confirmer</Label>
              <Input
                id="confirmer-suppression"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Button type="submit" variant="destructive" disabled={confirm !== ACCOUNT_DELETION_WORD || busy}>
              {busy ? "Suppression…" : "Supprimer définitivement mon compte"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Plus d'informations dans les{" "}
        <Link to="/mentions-legales" className="underline underline-offset-2">
          mentions légales
        </Link>
        .
      </p>
    </div>
  );
}
