import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedSrc = path.resolve(__dirname, "../../packages/shared/src");

export default defineConfig({
  base: "/orcamento/blanks-slitters/",
  plugins: [react()],
  resolve: {
    // Evita duas cópias de React (app + packages/shared/node_modules) — hooks quebram (página em branco).
    dedupe: ["react", "react-dom"],
    alias: {
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "@liganer/shared/react": path.join(sharedSrc, "react"),
      "@liganer/shared/saved-list.css": path.join(sharedSrc, "react/saved-list.css"),
      "@liganer/shared": sharedSrc,
    },
  },
  test: {
    environment: "node",
  },
});
