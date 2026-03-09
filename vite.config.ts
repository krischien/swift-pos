import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: mode !== "production" ? {
      "/api": {
        target: "http://localhost:4001",
        changeOrigin: true,
      },
    } : undefined,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: [
      "@capacitor/filesystem",
      "@capacitor/share",
      "@capacitor-community/sqlite",
    ],
  },
}));
