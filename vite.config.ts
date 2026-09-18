// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/leaflet") || id.includes("node_modules/react-leaflet")) {
              return "maps-vendor";
            }
            if (id.includes("node_modules/lottie-react")) {
              return "lottie-vendor";
            }
            if (id.includes("node_modules/recharts")) {
              return "charts-vendor";
            }
            if (id.includes("node_modules/framer-motion") || id.includes("node_modules/motion")) {
              return "motion-vendor";
            }
            if (id.includes("node_modules/@radix-ui")) {
              return "radix-vendor";
            }
            return undefined;
          },
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
