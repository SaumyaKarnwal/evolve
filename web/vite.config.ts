import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri serves the dev server at a fixed port and loads the built assets from disk,
// so we use a fixed port and relative asset paths.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 1420, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
