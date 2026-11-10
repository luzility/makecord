import { createRequire } from "node:module";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const require = createRequire(import.meta.url);

const OPTIONAL_NATIVE = ["bufferutil", "utf-8-validate", "zlib-sync", "@discordjs/opus"];

export default defineConfig({
  main: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, "src/main/index.ts"),
          "runtime-cli": require.resolve("@makecord/runtime/cli"),
          "language-service": require.resolve("@makecord/runtime/language-service"),
        },
        external: ["electron", ...OPTIONAL_NATIVE],
      },
    },
  },
  preload: {
    build: {
      rollupOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } },
    },
  },
  renderer: {
    resolve: { alias: { "@": resolve(import.meta.dirname, "src/renderer/src") } },
    plugins: [react(), tailwindcss()],
    build: { minify: true },
  },
});
