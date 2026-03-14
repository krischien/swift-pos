# QuickScale POS – Demo Credentials

## SaaS Mode (multi-store, `VITE_APP_MODE=saas`)

These accounts are created automatically when the SaaS server starts and the database has no users.

| Role        | Email            | Password   |
|-------------|------------------|------------|
| Super Admin | admin@demo.com   | password123 |
| Owner       | owner@demo.com   | password123 |
| Cashier     | cashier@demo.com | password123 |

- **Super Admin**: Full platform access, including `/admin` (organizations, plans).
- **Owner**: Manages organization, stores, users, categories, inventory.
- **Cashier**: POS and sales only.

## Solo Mode (single-store, default)

Run `npm run prisma:seed` to create these accounts if they are missing:

| Role   | Email            | Password   |
|--------|------------------|------------|
| Admin  | john@example.com | password123 |
| Cashier| cashier@example.com | password123 |

---

## Reset Password (SaaS only)

If demo accounts are locked out or have wrong passwords:

```bash
POST /api/demo/reset-passwords
```

This resets `admin@demo.com`, `owner@demo.com`, and `cashier@demo.com` to `password123`.
