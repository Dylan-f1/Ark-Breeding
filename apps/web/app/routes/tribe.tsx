import type { TribeMember } from "@ark-breeding/core";
import { Copy, Crown, MoreHorizontal, RefreshCw } from "lucide-react";
import { useState } from "react";
import { redirect, useNavigate, useRevalidator } from "react-router";
import { toast } from "sonner";
import { ServerSettingsForm } from "~/components/tribe/server-settings-form";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  ApiError,
  deleteTribe,
  excludeMember,
  fetchCurrentTribe,
  fetchCurrentUser,
  leaveTribe,
  regenerateInvite,
  renameTribe,
  transferTribe,
} from "~/lib/api";
import type { Route } from "./+types/tribe";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tribu — Ark-breeding" }];
}

export async function clientLoader() {
  const user = await fetchCurrentUser();
  if (!user) throw redirect("/connexion");
  try {
    return { user, tribe: await fetchCurrentTribe() };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw redirect("/connexion");
    throw e;
  }
}

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function Tribe({ loaderData }: Route.ComponentProps) {
  const { user, tribe } = loaderData;
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [name, setName] = useState(tribe.name);
  const [confirmName, setConfirmName] = useState("");
  const inviteUrl = tribe.invite ? `${window.location.origin}/rejoindre/${tribe.invite.code}` : null;
  const refresh = () => void revalidator.revalidate();

  async function run(action: () => Promise<unknown>, success: string, failure: string) {
    try {
      await action();
      toast.success(success);
      refresh();
    } catch {
      toast.error(failure);
    }
  }

  const exclude = (m: TribeMember) =>
    window.confirm(`Exclure ${m.displayName} de la tribu ? Il perdra l'accès à la bibliothèque.`) &&
    run(() => excludeMember(m.userId), `${m.displayName} a été exclu.`, "L'exclusion a échoué.");

  const transfer = (m: TribeMember) =>
    window.confirm(`Donner la tribu à ${m.displayName} ? Tu redeviendras simple membre.`) &&
    run(() => transferTribe(m.userId), `${m.displayName} est maintenant propriétaire.`, "Le transfert a échoué.");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{tribe.name}</h1>
        <p className="text-sm text-muted-foreground">
          {tribe.members.length} membre{tribe.members.length > 1 ? "s" : ""} · {tribe.creatureCount} créature
          {tribe.creatureCount > 1 ? "s" : ""}
          {tribe.isOwner && " · tu es propriétaire"}
        </p>
      </div>

      {tribe.isOwner && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => renameTribe(name.trim()), "Tribu renommée.", "Le nom doit faire entre 3 et 40 caractères.");
          }}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="nom">Nom de la tribu</Label>
            <Input id="nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          <Button type="submit" variant="outline" disabled={name.trim() === tribe.name || name.trim().length < 3}>
            Renommer
          </Button>
        </form>
      )}

      {/* EF-04 / EF-25 */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Inviter des joueurs</h2>
          </CardTitle>
          <CardDescription>Partage ce lien dans le Discord de ta tribu. Il est valable 7 jours.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {inviteUrl ? (
            <>
              <div className="flex gap-2">
                <Input readOnly value={inviteUrl} aria-label="Lien d'invitation" onFocus={(e) => e.target.select()} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(inviteUrl).then(() => toast.success("Lien copié."))}
                >
                  <Copy className="size-4" aria-hidden /> Copier
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Expire le {dateFr(tribe.invite!.expiresAt)}.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Le lien a expiré.{!tribe.isOwner && " Demande au propriétaire d'en générer un nouveau."}
            </p>
          )}
          {tribe.isOwner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                (!inviteUrl || window.confirm("L'ancien lien ne fonctionnera plus. Continuer ?")) &&
                void run(regenerateInvite, "Nouveau lien créé, valable 7 jours.", "Le lien n'a pas pu être régénéré.")
              }
            >
              <RefreshCw className="size-4" aria-hidden /> {inviteUrl ? "Régénérer le lien" : "Générer un nouveau lien"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Membres</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {tribe.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 py-2">
                <Avatar className="size-8">
                  {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                  <AvatarFallback>{m.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">
                    {m.displayName}
                    {m.userId === user.id && <span className="text-muted-foreground"> (toi)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">Depuis le {new Date(m.joinedAt).toLocaleDateString("fr-FR")}</p>
                </div>
                {m.isOwner && (
                  <Badge variant="secondary">
                    <Crown className="size-3" aria-hidden /> Propriétaire
                  </Badge>
                )}
                {tribe.isOwner && !m.isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions pour ${m.displayName}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => void transfer(m)}>Donner la propriété</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => void exclude(m)}>
                        Exclure de la tribu
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* EF-05 */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Réglages du serveur</h2>
          </CardTitle>
          <CardDescription>
            Les niveaux se calculent avec les multiplicateurs de ton serveur. Sur un serveur non officiel, renseigne-les
            sinon l'extraction échoue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ServerSettingsForm key={JSON.stringify(tribe.settings)} settings={tribe.settings} onSaved={refresh} />
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>
            <h2>Zone sensible</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tribe.isOwner ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void deleteTribe(confirmName)
                  .then(async () => {
                    toast.success(`La tribu « ${tribe.name} » a été supprimée.`);
                    await revalidator.revalidate();
                    navigate("/bibliotheque");
                  })
                  .catch(() => toast.error("La suppression a échoué."));
              }}
            >
              <Label htmlFor="confirmer">
                Supprimer la tribu et ses {tribe.creatureCount} créatures. Tape « {tribe.name} » pour confirmer.
              </Label>
              <div className="flex gap-2">
                <Input id="confirmer" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
                <Button type="submit" variant="destructive" disabled={confirmName.trim() !== tribe.name}>
                  Supprimer
                </Button>
              </div>
              {tribe.members.length > 1 && (
                <p className="text-xs text-muted-foreground">Pour partir sans supprimer, donne d'abord la propriété à un membre.</p>
              )}
            </form>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                window.confirm(`Quitter la tribu « ${tribe.name} » ?`) &&
                void leaveTribe()
                  .then(async () => {
                    toast.success("Tu as quitté la tribu.");
                    await revalidator.revalidate();
                    navigate("/bibliotheque");
                  })
                  .catch(() => toast.error("Impossible de quitter la tribu."))
              }
            >
              Quitter la tribu
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
