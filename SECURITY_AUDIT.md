# Security Audit Report

## Critical

### 1. Unauthenticated Dangerous Endpoints (Solo Server)

**Location:** `server/index.ts`

The solo server has **no authentication** on any endpoints. Anyone who can reach the API can:
- List, create, restore backups (`/api/backups`, `/api/backups/restore`, `/api/backups/create`)
- Restore database from arbitrary backup (see Path Traversal below)
- Create/update/delete users, products, categories, sales
- Generate BIR reports

**Recommendation:** Add authentication middleware to the solo server. At minimum, protect backup and user management endpoints.

---

### 2. Unauthenticated Password Reset (SaaS)

**Location:** `server/saas/index.ts` lines 37–60

`POST /api/demo/reset-passwords` resets all demo user passwords to `password123` with **no authentication**. Anyone can call this endpoint and take over demo accounts.

**Recommendation:** Remove this endpoint in production, or restrict it to `NODE_ENV=development` only.

---

### 3. Path Traversal in Backup Restore

**Location:** `server/utils/backupService.ts` + `server/index.ts`

`restoreFromBackup(backupFilename)` uses `path.join(BACKUPS_DIR, backupFilename)`. The validation only checks that the filename starts with `backup-` and ends with `.db`. A value like `backup-../../../etc/passwd.db` could pass validation but resolve outside the backups directory.

**Recommendation:** Resolve the path and ensure it stays within `BACKUPS_DIR`:

```ts
const backupPath = path.resolve(BACKUPS_DIR, backupFilename);
if (!backupPath.startsWith(path.resolve(BACKUPS_DIR))) {
  throw new Error("Invalid backup path");
}
```

---

### 4. JWT Secret Fallback

**Location:** `server/saas/middleware/auth.ts` line 4

```ts
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
```

If `JWT_SECRET` is not set, a weak default is used. Tokens could be forged.

**Recommendation:** Fail startup if `JWT_SECRET` is missing or equals the default in production.

---

## High

### 5. CORS Allows All Origins

**Location:** `server/index.ts`, `server/saas/index.ts`

```ts
app.use(cors());
```

With no options, CORS allows requests from any origin. Combined with token storage in `localStorage`, this increases risk of token theft via XSS on other sites.

**Recommendation:** Restrict origins in production:

```ts
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:8080"] }));
```

---

### 6. Sensitive Data in Logs

**Location:** Multiple files

- `server/saas/index.ts`: `[Login] User not found: ${email}`, `[Login] Password mismatch for ${email}`
- `server/saas/index.ts`: `[Login] Auto-reset password for ${email}`
- `src/lib/mobileDb.ts`: `console.log("dbExecute:", sql, "params:", params)` — can log passwords

**Recommendation:** Avoid logging PII and credentials. Disable or redact in production.

---

### 7. No Rate Limiting

Login, signup, and password reset endpoints have no rate limiting. Brute-force and credential stuffing are easier.

**Recommendation:** Add rate limiting (e.g. `express-rate-limit`) on auth endpoints.

---

## Medium

### 8. Password in Update Without Hashing (Solo)

**Location:** `server/index.ts` lines 355–361

```ts
if (password !== undefined) updateData.password = password;
const user = await updateUserService(req.params.id, updateData);
```

Password is passed to `updateUserService` without hashing. If the service stores it as-is, passwords would be stored in plain text.

**Recommendation:** Hash the password before updating, as in the SaaS `userService`.

---

### 9. `dangerouslySetInnerHTML` Usage

**Location:** `src/components/ui/chart.tsx` line 70

Used for chart theme CSS. Content is built from `THEMES` and `colorConfig`, not user input, so XSS risk is low. Still worth reviewing if any values can be user-controlled.

---

### 10. Token in localStorage

**Location:** `src/lib/saasAuth.ts`, `src/contexts/AuthContext.tsx`

JWT is stored in `localStorage`. If XSS exists elsewhere, tokens can be stolen.

**Recommendation:** Prefer `httpOnly` cookies for tokens where possible. If using `localStorage`, ensure strict CSP and no XSS.

---

## Low

### 11. Hardcoded Demo Credentials in Frontend

**Location:** `src/pages/Login.tsx`

Demo credentials (`admin@demo.com`, `password123`, etc.) are in source. Fine for demo, but avoid in production builds.

---

### 12. Verbose Error Messages

Some endpoints return raw error messages that can leak implementation details. Use generic messages for clients and log details server-side.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High     | 3 |
| Medium   | 3 |
| Low      | 2 |

**Immediate actions:**
1. Protect or remove `/api/demo/reset-passwords`.
2. Fix path traversal in backup restore.
3. Add authentication to solo server (or at least backup endpoints).
4. Enforce JWT secret in production.
5. Add rate limiting on auth endpoints.
