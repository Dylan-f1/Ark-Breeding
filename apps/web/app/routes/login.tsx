import { redirect, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DISCORD_LOGIN_URL, fetchCurrentUser } from "~/lib/api";
import type { Route } from "./+types/login";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Connexion — Ark-breeding" }];
}

export async function clientLoader() {
  if (await fetchCurrentUser()) throw redirect("/bibliotheque");
  return null;
}

export default function Login() {
  const [params] = useSearchParams();
  const error = params.get("erreur");

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Connexion</h1>
          </CardTitle>
          <CardDescription>
            Connecte-toi pour retrouver ta bibliothèque et celle de ta tribu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              La connexion avec Discord a échoué. Réessaie.
            </p>
          )}
          {/* Plain link: the API answers with a redirect to Discord, not JSON. */}
          <Button asChild className="w-full">
            <a href={DISCORD_LOGIN_URL}>Se connecter avec Discord</a>
          </Button>
          <p className="text-xs text-muted-foreground">
            On ne récupère que ton pseudo et ton avatar Discord, jamais ton email.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
