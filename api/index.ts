/**
 * Vercel serverless function - handles all /api/* routes.
 * Static TS import helps Vercel trace and bundle dependencies correctly.
 */
import app from "../server/saas/index.ts";

export default app;
