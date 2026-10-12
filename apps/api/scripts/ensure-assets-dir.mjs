// In dev the front is served by Vite, so wrangler gets its own empty assets folder:
// pointing it at apps/web/build would lock that folder on Windows and break `npm run build`.
import { mkdirSync } from "node:fs";

mkdirSync(new URL("../.wrangler/dev-assets", import.meta.url), { recursive: true });
