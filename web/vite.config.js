import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      // about.html is a second, standalone entry (no React, no bundle) —
      // real static HTML so it's indexable and readable with no JS at all.
      // See its own top-of-file comment for why it's a separate file
      // instead of a route inside the SPA.
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        about: resolve(import.meta.dirname, "about.html"),
      },
    },
  },
});
