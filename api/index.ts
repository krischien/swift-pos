/**
 * Vercel serverless function - handles all /api/* routes.
 * Imports bundled app (built by build:api) so server code is included in deployment.
 */
import app from "./saas-app.js";

export default app;
