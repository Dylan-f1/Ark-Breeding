import { Link, NavLink, Outlet, useNavigate, useRevalidator } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { fetchCurrentUser, logout } from "~/lib/api";
import type { Route } from "./+types/site-layout";

export async function clientLoader() {
  return { user: await fetchCurrentUser() };
}

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  async function handleLogout() {
    await logout();
    await revalidator.revalidate();
    navigate("/");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="font-semibold tracking-tight">
            Ark-breeding
          </Link>
          <nav aria-label="Navigation principale" className="flex gap-4 text-sm">
            <NavLink
              to="/bibliotheque"
              className={({ isActive }) =>
                isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              }
            >
              Bibliothèque
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <Avatar className="size-8">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                  <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">{user.displayName}</span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Se déconnecter
                </Button>
              </>
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

      <footer className="border-t text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-6">
          <p>
            Site de fans non officiel, sans lien avec Studio Wildcard. ARK: Survival Ascended est une
            marque de Studio Wildcard.
          </p>
          <p>
            <Link to="/mentions-legales" className="underline underline-offset-2">
              Mentions légales et crédits
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
