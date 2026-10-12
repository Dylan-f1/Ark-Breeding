import { redirect } from "react-router";
import { fetchCurrentUser } from "~/lib/api";
import type { Route } from "./+types/library";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Bibliothèque — Ark-breeding" }];
}

export async function clientLoader() {
  const user = await fetchCurrentUser();
  if (!user) throw redirect("/connexion");
  return { user };
}

export default function Library({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Bibliothèque</h1>
      <p className="text-muted-foreground">
        Bienvenue {loaderData.user.displayName}. Tes créatures apparaîtront ici.
      </p>
    </div>
  );
}
