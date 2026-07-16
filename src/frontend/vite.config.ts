import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Matches docker-compose.yml's host-side port mapping (8080:8080) exactly — kept identical
  // on purpose so Vite's own printed "Local: http://localhost:8080" is the actual reachable
  // address, not an internal container port that differs from what's published on the host
  // (that mismatch is what breaks tools like VS Code's port-forwarding auto-detection, which
  // works by parsing port numbers out of terminal/log output).
  server: {
    port: 8080,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(dirname, "index.html"),
        privacy: resolve(dirname, "privacy.html"),
        impressum: resolve(dirname, "impressum.html"),
        beta: resolve(dirname, "beta.html"),
        developer: resolve(dirname, "developer.html"),
      },
    },
  },
});
