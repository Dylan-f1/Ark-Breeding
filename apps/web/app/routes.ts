import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/site-layout.tsx", [
    index("routes/home.tsx"),
    route("connexion", "routes/login.tsx"),
    route("bibliotheque", "routes/library.tsx"),
  ]),
] satisfies RouteConfig;
