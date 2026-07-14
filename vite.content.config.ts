import path from "node:path"
import { defineConfig } from "vite"

// MV3 content scripts must be a single classic script (no ESM imports), so they
// get their own IIFE build that writes into the popup's dist/ without clearing it.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/content/index.ts"),
      name: "LinkedInMd",
      formats: ["iife"],
      fileName: () => "content.js",
    },
  },
})
