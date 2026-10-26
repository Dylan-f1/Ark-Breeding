import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/site-layout.tsx", [
    index("routes/home.tsx"),
    route("connexion", "routes/login.tsx"),
    route("bibliotheque", "routes/library.tsx"),
    route("bibliotheque/ajouter", "routes/library-add.tsx"),
    route("lignee/:speciesId", "routes/lineage.tsx"),
    route("creature/:id", "routes/creature.tsx"),
    route("minuteurs", "routes/timers.tsx"),
    route("tribu", "routes/tribe.tsx"),
    route("compte", "routes/account.tsx"),
    route("rejoindre/:code", "routes/join.tsx"),
    route("mentions-legales", "routes/legal.tsx"),
    // D-27: colour preview proposals (EF-22), not linked from the menu
    route("apercu-couleurs", "routes/colors-preview.tsx"),
  ]),
  // EF-18: public pages, pre-rendered at build time (react-router.config.ts)
  layout("routes/public-layout.tsx", [
    route("especes", "routes/species-list.tsx"),
    route("especes/:slug", "routes/species-detail.tsx"),
  ]),
] satisfies RouteConfig;
