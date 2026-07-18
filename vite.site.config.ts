import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1);
const pagesBase = repositoryName ? `/${repositoryName}/` : "/";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? pagesBase : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@site": fileURLToPath(new URL("./site", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "site-dist",
    emptyOutDir: true,
  },
});
