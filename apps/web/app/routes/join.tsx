import { useState } from "react";
import { Link, useNavigate, useRevalidator } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ApiError, DISCORD_LOGIN_URL, fetchCurrentUser, fetchInvite, joinTribe } from "~/lib/api";
import type { Route } from "./+types/join";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Rejoindre une tribu — Ark-breeding" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const user = await fetchCurrentUser();
  try {
    return { user, invite: await fetchInvite(params.code) };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { user, invite: null };
    throw e;
  }
}

/** EF-04: page reached from the invitation link. */
export default function Join({ loaderData, params }: Route.ComponentProps) {
  const { user, invite } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    try {
      const tribe = await joinTribe(params.code);
      toast.success(`Bienvenue dans la tribu « ${tribe.name} » !`);
      // the header (layout loader) shows the current tribe
      await revalidator.revalidate();
      navigate("/bibliotheque");
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 410 ? "Ce lien a expiré." : "Impossible de rejoindre la tribu.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{invite ? `Rejoindre « ${invite.tribeName} »` : "Invitation introuvable"}</h1>
          </CardTitle>
          {invite && (
            <CardDescription>
              {invite.memberCount > 1 ? `${invite.memberCount} membres partagent déjà leur` : "1 membre partage déjà sa"} bibliothèque d'élevage.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!invite ? (
            <p className="text-sm text-muted-foreground">Ce lien n'existe pas ou a été remplacé. Demande un nouveau lien à ta tribu.</p>
          ) : invite.alreadyMember ? (
            <>
              <p className="text-sm">Tu fais déjà partie de cette tribu.</p>
              <Button onClick={() => void join()} disabled={busy}>
                Ouvrir sa bibliothèque
              </Button>
            </>
          ) : invite.expired ? (
            <p className="text-sm text-muted-foreground">Ce lien a expiré. Demande au propriétaire de la tribu d'en générer un nouveau.</p>
          ) : user ? (
            <Button className="w-full" onClick={() => void join()} disabled={busy}>
              {busy ? "Un instant…" : "Rejoindre la tribu"}
            </Button>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Connecte-toi pour rejoindre la tribu.</p>
              <Button asChild className="w-full">
                <a href={`${DISCORD_LOGIN_URL}?retour=${encodeURIComponent(`/rejoindre/${params.code}`)}`}>Se connecter avec Discord</a>
              </Button>
            </>
          )}
          <Button asChild variant="ghost" className="w-full">
            <Link to="/">Découvrir Ark-breeding</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
