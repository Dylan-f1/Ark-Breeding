import { createRequire } from "node:module";
import { dirname } from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // the shadcn CLI pulls zod 3 to the root node_modules: packages/core needs its own zod 4
      // (z.iso…), not the hoisted one, in the browser bundle and the pre-rendering alike
      zod: dirname(createRequire(new URL("../../packages/core/package.json", import.meta.url)).resolve("zod/package.json")),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Fewer, larger chunks instead of one per icon/component: fewer requests (RSE-01).
        // The species data (≈500 kB) stays in its own lazily loaded chunk.
        codeSplitting: {
          groups: [
            { name: "vendor", test: /node_modules/ },
            { name: "app", test: /packages[\\/]core[\\/]src[\\/](?!species-data)|app[\\/](components|lib)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Same origin as production: the browser only ever talks to :5173.
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
