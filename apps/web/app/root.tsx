import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { useSyncExternalStore } from "react";

import type { Route } from "./+types/root";
import { Toaster } from "~/components/ui/sonner";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
        {/* D-35: one dark theme; the status bar takes the colour of the rail at the top */}
        <meta name="theme-color" content="#142632" />
        <meta name="color-scheme" content="dark" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster richColors closeButton />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  return (
    <p className="p-8 text-center text-muted-foreground" role="status">
      Chargement…
    </p>
  );
}

// false while hydrating the HTML served by the Worker, true on every client render after that
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // An unknown URL gets the SPA fallback (index.html, pre-rendered with HydrateFallback) while
  // the client router starts straight on this 404: render the fallback first so the hydration
  // matches, then the error.
  const hydrated = useHydrated();
  if (!hydrated) return <HydrateFallback />;

  let message = "Oups !";
  let details = "Une erreur inattendue est survenue.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Erreur";
    details =
      error.status === 404 ? "Cette page n'existe pas." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="text-2xl font-semibold">{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
