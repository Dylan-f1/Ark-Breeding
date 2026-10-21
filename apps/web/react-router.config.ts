import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildCatalog } from "@ark-breeding/core";
import { ASA_SPECIES } from "@ark-breeding/core/species-data";
import type { Config } from "@react-router/dev/config";

const SITE_URL = (process.env.VITE_SITE_URL || "https://ark-breeding.ark-breeding-api.workers.dev").replace(/\/$/, "");
const speciesPaths = ["/especes", ...buildCatalog(ASA_SPECIES).map((e) => `/especes/${e.slug}`)];

export default {
  // Static build served by the API Worker. The public species pages are pre-rendered (EF-18,
  // ENF-05): crawlers get their content without running JavaScript.
  ssr: false,
  prerender: speciesPaths,
  // ENF-05: sitemap of the public pages, and where to find it
  async buildEnd({ reactRouterConfig }) {
    const client = join(reactRouterConfig.buildDirectory, "client");
    const urls = ["/", "/mentions-legales", ...speciesPaths]
      .map((path) => `  <url><loc>${SITE_URL}${path === "/" ? "/" : path}</loc></url>`)
      .join("\n");
    await writeFile(
      join(client, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );
    await writeFile(
      join(client, "robots.txt"),
      `User-agent: *\nDisallow: /api/\nDisallow: /bibliotheque\nDisallow: /creature/\nDisallow: /lignee/\nDisallow: /tribu\nDisallow: /compte\nDisallow: /rejoindre/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    );
  },
} satisfies Config;
