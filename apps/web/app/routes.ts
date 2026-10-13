import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/site-layout.tsx", [
    index("routes/home.tsx"),
    route("connexion", "routes/login.tsx"),
    route("bibliotheque", "routes/library.tsx"),
    route("bibliotheque/ajouter", "routes/library-add.tsx"),
    route("lignee/:speciesId", "routes/lineage.tsx"),
    route("creature/:id", "routes/creature.tsx"),
    route("tribu", "routes/tribe.tsx"),
    route("rejoindre/:code", "routes/join.tsx"),
    route("mentions-legales", "routes/legal.tsx"),
  ]),
] satisfies RouteConfig;
