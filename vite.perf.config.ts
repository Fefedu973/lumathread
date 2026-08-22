import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./perf/harness", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("./perf-dist", import.meta.url)),
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      input: fileURLToPath(
        new URL("./perf/harness/index.html", import.meta.url),
      ),
    },
  },
  server: {
    host: "127.0.0.1",
    fs: {
      allow: [projectRoot],
    },
  },
});
