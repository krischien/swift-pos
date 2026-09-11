'use strict';

/**
 * Vercel serverless entry. Real Express app is built to ./_handler.cjs by `npm run build:api`.
 * api/package.json forces CommonJS so @vercel/node does not treat this as ESM.
 */
try {
  const mod = require('./_handler.cjs');
  module.exports = mod.default || mod;
} catch (err) {
  console.error('[api] Failed to load _handler.cjs:', err);
  module.exports = (_req, res) => {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, message: 'API bundle not built yet' }));
  };
}
