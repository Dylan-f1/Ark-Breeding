import { Link } from "react-router";

export function SiteFooter() {
  return (
    <footer className="border-t text-xs text-muted-foreground">
      <div className="mx-auto max-w-6xl space-y-1 px-4 py-6">
        <p>
          Site de fans non officiel, sans lien avec Studio Wildcard. ARK: Survival Ascended est une marque de Studio
          Wildcard.
        </p>
        <p className="flex flex-wrap gap-x-4">
          <Link to="/especes" className="underline underline-offset-2">
            Espèces
          </Link>
          <Link to="/mentions-legales" className="underline underline-offset-2">
            Mentions légales et crédits
          </Link>
        </p>
      </div>
    </footer>
  );
}
