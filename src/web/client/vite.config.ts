import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    host: "localhost",
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: process.env.VITE_API_URL || "http://localhost:3000",
        ws: true,
      },
    },
  },

  build: {
    outDir: resolve(__dirname, "../../../dist/web/client"),
    emptyOutDir: true,
    sourcemap: true,
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
