import { createRequire } from "module";

/**
 * Vercel serverless function - handles all /api/* routes.
 * Use createRequire so module resolution works reliably in Vercel runtime.
 */
const require = createRequire(import.meta.url);
const app = require("../server/saas/index.js").default;

export default app;
