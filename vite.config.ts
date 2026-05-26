import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart(),
    tsconfigPaths(),
  ],
  server: {
    port: 5000,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
