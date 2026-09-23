import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/orcamento/blanks-slitters/",
  plugins: [react()],
  test: {
    environment: "node",
  },
});
