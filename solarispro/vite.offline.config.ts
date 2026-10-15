import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  configFile: false,
  root: ".",
  plugins: [react(), tailwindcss(), tsconfigPaths(), viteSingleFile()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  build: {
    outDir: "offline-dist",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { input: "offline.html" },
  },
});
