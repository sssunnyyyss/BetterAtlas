import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["courses.sunworkstudios.com"],
    proxy: {
      "/api": {
        // In Docker Compose, the API is reachable by its service name.
        target: "http://api:3001",
        changeOrigin: true,
      },
    },
  },
});
