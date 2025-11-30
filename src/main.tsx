import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";
import { initDatabase } from "./lib/mobileDb";

// Initialize database on native platforms
if (Capacitor.isNativePlatform()) {
  initDatabase()
    .then(() => {
      console.log("Database initialized on app startup");
    })
    .catch((error) => {
      console.error("Failed to initialize database on startup:", error);
    });
}

createRoot(document.getElementById("root")!).render(<App />);
