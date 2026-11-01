import { useEffect } from "react";
import { Link, useRevalidator } from "react-router";
import { toast } from "sonner";
import { AccountMenu } from "~/components/layout/account-menu";
import { AppShell } from "~/components/layout/app-shell";
import { Button } from "~/components/ui/button";
import { acknowledgeNotices, fetchMe, fetchTribes } from "~/lib/api";
import type { Route } from "./+types/site-layout";

export async function clientLoader() {
  const me = await fetchMe();
  const tribes = me.user ? await fetchTribes() : null;
  return { user: me.user, notices: me.notices, tribes };
}

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  const { user, notices, tribes } = loaderData;
  const revalidator = useRevalidator();

  // tribe deleted, excluded…: shown once
  useEffect(() => {
    if (!notices.length) return;
    for (const n of notices) toast.info(n.message, { id: n.id, duration: 10_000 });
    void acknowledgeNotices();
  }, [notices]);

  return (
    <AppShell
      signedIn={!!user}
      account={
        user && tribes ? (
          <AccountMenu user={user} tribes={tribes} onChanged={() => revalidator.revalidate()} />
        ) : (
          <Button asChild size="sm">
            <Link to="/connexion">Se connecter</Link>
          </Button>
        )
      }
    />
  );
}
