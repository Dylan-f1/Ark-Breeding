import { BookOpen, Dna, Timer, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { SiteFooter } from "~/components/layout/site-footer";

const SECTIONS = [
  { to: "/bibliotheque", label: "Bibliothèque", Icon: BookOpen, signedIn: false },
  { to: "/especes", label: "Espèces", Icon: Dna, signedIn: false },
  { to: "/minuteurs", label: "Minuteurs", Icon: Timer, signedIn: true },
  { to: "/tribu", label: "Tribu", Icon: Users, signedIn: true },
] as const;

/**
 * D-35 « Console de tribu »: the game's side tabs. Full rail from 1024 px, icons only on tablets,
 * and on phones the wordmark stays on top while the sections move to a tab bar under the thumb.
 */
export function AppShell({ signedIn, account }: { signedIn: boolean; account: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[3.75rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)]">
      {/* keyboard: straight past the rail to the page */}
      <a
        href="#contenu"
        className="sr-only z-50 rounded-sm bg-card px-3 py-2 text-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>
      <aside className="flex items-center justify-between gap-3 border-b bg-card px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 md:sticky md:top-0 md:h-dvh md:flex-col md:items-stretch md:justify-start md:gap-8 md:border-r md:border-b-0 md:px-0 md:py-5">
        <Link
          to="/"
          aria-label="Ark-breeding, accueil"
          className="text-xl font-bold whitespace-nowrap text-primary [font-stretch:62%] md:text-center lg:px-5 lg:text-left lg:text-2xl"
        >
          <span className="md:hidden lg:inline">Ark-breeding</span>
          <span className="hidden md:inline lg:hidden" aria-hidden>
            AB
          </span>
        </Link>
        <nav
          aria-label="Navigation principale"
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:static md:border-0 md:bg-transparent md:pb-0"
        >
          <ul className="flex md:flex-col">
            {SECTIONS.filter((s) => signedIn || !s.signedIn).map(({ to, label, Icon }) => (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={to === "/bibliotheque"}
                  title={label}
                  className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground aria-[current=page]:text-primary aria-[current=page]:shadow-[inset_0_2px_0_var(--primary)] md:py-3 md:hover:bg-panel-2 md:aria-[current=page]:bg-panel-2 md:aria-[current=page]:shadow-[inset_2px_0_0_var(--primary)] lg:flex-row lg:gap-3 lg:px-5 lg:py-2.5 lg:text-sm"
                >
                  <Icon className="size-5 lg:size-4" aria-hidden />
                  <span className="md:sr-only lg:not-sr-only">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:mt-auto md:flex md:justify-center lg:block lg:px-3">{account}</div>
      </aside>

      {/* room for the phone tab bar under the content */}
      <div className="flex min-w-0 flex-col pb-16 md:pb-0">
        <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none md:px-6 lg:px-8">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
