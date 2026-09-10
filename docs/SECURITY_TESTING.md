# Security testing (API)

Lightweight API security checks for the SaaS backend (`server/saas/`). These run against **HTTP only** — no browser required.

**Phase 1.4 hardening** (rate limits, JWT/CORS startup checks, demo endpoint gates, input sanitization, headers) is implemented in the server first. **Expanded security tests** (CORS preflight, rate-limit 429, two-org isolation, etc.) will be added in a follow-up after hardening is verified.

## What is checked today

| Category | Examples |
|----------|----------|
| **Authentication** | Missing/invalid JWT → 401; missing `storeId` → 400; no password in login JSON |
| **RBAC** | Cashier blocked from product/category/user writes and `/api/admin/*`; owner read allowed |
| **Tenant isolation** | Unknown `storeId` → 403 |
| **Dev endpoints** | `POST /api/demo/reset-passwords` open in local dev |
| **Production hardening** | Optional: demo reset returns 404 when server runs as production |

## CSRF posture

- Auth uses **Bearer JWT** in the `Authorization` header (`localStorage` via [`src/lib/saasAuth.ts`](../src/lib/saasAuth.ts)), not session cookies.
- Browsers do not attach Bearer tokens to cross-site form posts automatically, so classic **CSRF is low risk** for this API shape.
- The main practical risk is **XSS** stealing `saas_token` from `localStorage`. Mitigations: React escaping, API input sanitization (`server/saas/utils/sanitizeInput.ts`), avoid rendering user HTML.
- No CSRF tokens in Phase 1.4; revisit only if moving to cookie-based sessions.

## XSS notes

- React escapes rendered text by default.
- The only `dangerouslySetInnerHTML` usage is [`src/components/ui/chart.tsx`](../src/components/ui/chart.tsx) for **theme CSS** (not user content).

## Dependency scanning

```powershell
npm run security:audit
```

Runs `npm audit --audit-level=high`. This is separate from `npm run security` (API behavior smoke tests).

## Prerequisites

- API running at `http://localhost:4001` (default)
- Demo users seeded: `admin@demo.com`, `owner@demo.com`, `cashier@demo.com` / `password123`

## Run

```powershell
# Terminal 1
npm run dev:saas

# Terminal 2
npm run security
```

One command (starts API, runs checks, stops server):

```powershell
npm run security:ci
```

Custom API URL:

```powershell
$env:SECURITY_API_URL="http://localhost:4001"
npm run security
```

### Cross-org manual QA (dev)

```powershell
npm run saas:seed-second-org
# Login as owner@orgb.demo.com / password123 — verify Org A token cannot read Org B storeId
```

## Production-mode check (optional)

To assert Phase 1.3/1.4 demo endpoints are blocked, start the API with `NODE_ENV=production` and:

```powershell
$env:SECURITY_EXPECT_PRODUCTION="1"
npm run security
```

The `prod-demo-reset-blocked` test runs only in that mode; the local-dev demo reset test is skipped.

## Output

Green `✓ ALL SECURITY CHECKS PASSED` on success, or red failure list with test id, category, and error message.

## Extending

Add cases in `security/tests.mjs`. Shared helpers live in `security/fixtures/api.mjs`.

This is **smoke-level** security testing (auth/RBAC/tenant boundaries), not a replacement for OWASP ZAP or full penetration testing.
