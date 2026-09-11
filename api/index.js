/**
 * Vercel serverless entry (ESM — root package.json has "type": "module").
 * The Express app is bundled as CommonJS in handler.cjs (see npm run build:api).
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mod = require("./handler.cjs");

export default mod.default ?? mod;
