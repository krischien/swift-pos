import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import http from "node:http";

const apiProxyAgent = new http.Agent({ keepAlive: false });

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: mode !== "production" ? {
      "/api": {
        // Use IPv4 explicitly — on Windows, "localhost" can race ::1 vs 127.0.0.1 and cause ECONNRESET.
        target: "http://127.0.0.1:4001",
        changeOrigin: true,
        timeout: 120_000,
        proxyTimeout: 120_000,
        agent: apiProxyAgent,
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            console.warn("[vite] api proxy error:", err.message);
            if (res && "writeHead" in res && !res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  message:
                    "API connection lost. Ensure npm run dev:saas is running, then retry.",
                }),
              );
            }
          });
        },
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
