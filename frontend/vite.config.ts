import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8004",
        changeOrigin: true,
      },
      "/media": {
        target: "http://localhost:8004",
        changeOrigin: true,
      },
    },
  },
});