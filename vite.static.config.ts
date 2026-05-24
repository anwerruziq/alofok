import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

// SPA-only build for static hosting (Render, Vercel, Netlify, etc.)
// Stubs Node.js modules that TanStack Start/CityScene use in SSR mode.
export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "build.dist",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "node:async_hooks": path.resolve(__dirname, "src/stubs/async-hooks.ts"),
      "fs": path.resolve(__dirname, "src/stubs/fs.ts"),
      "path": path.resolve(__dirname, "src/stubs/path.ts"),
    },
  },
});
