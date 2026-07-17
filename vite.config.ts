import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: "lumathread",
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime"],
      output: {
        banner: '"use client";',
      },
    },
  },
});
