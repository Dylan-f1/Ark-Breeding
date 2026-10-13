import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
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
