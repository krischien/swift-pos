/**
 * Vercel serverless entry (ESM). Express app lives in saas-api-handler.cjs at repo root
 * so @vercel/node keeps it as a separate file (see vercel.json includeFiles).
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mod = require("../saas-api-handler.cjs");

export default mod.default ?? mod;
