import { Link, NavLink, Outlet } from "react-router";
import { SiteFooter } from "~/components/layout/site-footer";
import { Button } from "~/components/ui/button";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground";

/**
 * EF-18: layout of the public pages, pre-rendered at build time (ENF-05). No loader: the signed-in
 * player is not known there, the button leads to the library (or to the sign-in page).
 */
export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6">
          <Link to="/" className="font-semibold tracking-tight whitespace-nowrap">
            Ark-breeding
          </Link>
          <nav aria-label="Navigation principale" className="flex gap-4 text-sm">
            <NavLink to="/bibliotheque" className={navClass}>
              Bibliothèque
            </NavLink>
            <NavLink to="/especes" className={navClass}>
              Espèces
            </NavLink>
          </nav>
          <Button asChild size="sm" className="ml-auto">
            <Link to="/bibliotheque">Mon élevage</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
