# SwiftPOS – Demo Credentials

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

### Subscription plans (org-level)

| Tier | Price | Branches | Users |
|------|-------|----------|-------|
| **Tindahan** | ₱499/mo | up to 3 | up to 5 |
| **Negosyo** | ₱999/mo | up to 8 | up to 15 |
| **Kumpanya** | ₱1,999/mo | unlimited | unlimited |

New signups start a **7-day trial** (Tindahan limits). There is no free plan. After expiry, owners choose a plan at `/pricing`; Super Admin activates in `/admin/organizations/:id`. Setup fee: ₱1,499 first month.

Backfill existing orgs: `npm run saas:backfill-subscriptions`

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
