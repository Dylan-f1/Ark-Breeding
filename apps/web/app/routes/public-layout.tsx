import type { PublicUser, TribesResponse } from "@ark-breeding/core";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AccountMenu } from "~/components/layout/account-menu";
import { AppShell } from "~/components/layout/app-shell";
import { Button } from "~/components/ui/button";
import { fetchMe, fetchTribes } from "~/lib/api";

/**
 * EF-18: layout of the public pages, pre-rendered at build time (ENF-05). No loader: the signed-in
 * player is not known in the pre-rendered page, so the rail asks once in the browser and then shows
 * the same tabs and account menu as everywhere else.
 */
export default function PublicLayout() {
  const [me, setMe] = useState<{ user: PublicUser; tribes: TribesResponse } | null>(null);
  const load = useCallback(async () => {
    try {
      const { user } = await fetchMe();
      setMe(user ? { user, tribes: await fetchTribes() } : null);
    } catch {
      setMe(null);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell
      signedIn={!!me}
      account={
        me ? (
          <AccountMenu user={me.user} tribes={me.tribes} onChanged={load} />
        ) : (
          // the icon rail of tablets has no room for it: its Bibliothèque tab leads to the same page
          <Button asChild size="sm" className="md:hidden lg:inline-flex lg:w-full">
            <Link to="/bibliotheque">Mon élevage</Link>
          </Button>
        )
      }
    />
  );
}
