import { ChevronDown, LogOut, Plus, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useRevalidator } from "react-router";
import { toast } from "sonner";
import { SiteFooter } from "~/components/layout/site-footer";
import { CreateTribeDialog } from "~/components/tribe/create-tribe-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { acknowledgeNotices, fetchMe, fetchTribes, logout, switchTribe } from "~/lib/api";
import type { Route } from "./+types/site-layout";

export async function clientLoader() {
  const me = await fetchMe();
  const tribes = me.user ? await fetchTribes() : null;
  return { user: me.user, notices: me.notices, tribes };
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground";

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  const { user, notices, tribes } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [creating, setCreating] = useState(false);

  // tribe deleted, excluded…: shown once
  useEffect(() => {
    if (!notices.length) return;
    for (const n of notices) toast.info(n.message, { id: n.id, duration: 10_000 });
    void acknowledgeNotices();
  }, [notices]);

  async function handleLogout() {
    await logout();
    await revalidator.revalidate();
    navigate("/");
  }

  async function handleSwitch(tribeId: string) {
    if (tribeId === tribes?.current.id) return;
    await switchTribe(tribeId);
    await revalidator.revalidate();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6">
          <Link to="/" className="font-semibold tracking-tight whitespace-nowrap">
            Ark-breeding
          </Link>
          <nav aria-label="Navigation principale" className="flex gap-4 text-sm">
            <NavLink to="/bibliotheque" end className={navClass}>
              Bibliothèque
            </NavLink>
            <NavLink to="/especes" className={navClass}>
              Espèces
            </NavLink>
            {user && (
              <NavLink to="/tribu" className={navClass}>
                Tribu
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user && tribes ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2" aria-label="Menu du compte et des tribus">
                    <Avatar className="size-7">
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                      <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-40 truncate text-sm sm:inline">{tribes.current.name}</span>
                    <ChevronDown className="size-4 opacity-60" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal">
                    Connecté en tant que <span className="font-medium">{user.displayName}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Mes tribus</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={tribes.current.id} onValueChange={(id) => void handleSwitch(id)}>
                    {tribes.tribes.map((t) => (
                      <DropdownMenuRadioItem key={t.id} value={t.id}>
                        <span className="truncate">{t.name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuItem onSelect={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden /> Créer une tribu
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/tribu">
                      <Users className="size-4" aria-hidden /> Gérer la tribu
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/compte">
                      <UserRound className="size-4" aria-hidden /> Mon compte
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleLogout()}>
                    <LogOut className="size-4" aria-hidden /> Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <Link to="/connexion">Se connecter</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <SiteFooter />

      <CreateTribeDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          toast.success("Tribu créée.");
          void revalidator.revalidate();
          navigate("/tribu");
        }}
      />
    </div>
  );
}
