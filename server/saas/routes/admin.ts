import { Router } from "express";
import bcrypt from "bcryptjs";
import type { AuthRequest } from "../middleware/auth.js";
import { saasPrisma } from "../db.js";
import { runSeedDemo } from "../services/seedDemoService.js";

const router = Router();

/** Single store id from query, or null when reporting across all stores */
function parseAdminStoreIdQuery(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null || typeof v !== "string") return null;
  const s = v.trim();
  if (s === "" || s === "all" || s === "undefined" || s === "null") return null;
  return s;
}

function parseQueryDate(raw: unknown, fallback: Date): Date {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null || typeof v !== "string" || v.trim() === "") return fallback;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

router.post("/organizations", async (req: AuthRequest, res) => {
  try {
    const { name, storeName, ownerEmail, ownerPassword, ownerName, phone, email, address } =
      req.body as {
        name?: string;
        storeName?: string;
        ownerEmail?: string;
        ownerPassword?: string;
        ownerName?: string;
        phone?: string;
        email?: string;
        address?: string;
      };

    if (!name?.trim()) {
      return res.status(400).json({ message: "Organization name is required" });
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    const org = await saasPrisma.organization.create({
      data: {
        name: name.trim(),
        trialEndsAt,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    });

    let storeId: string | null = null;
    if (storeName?.trim()) {
      const store = await saasPrisma.store.create({
        data: {
          organizationId: org.id,
          name: storeName.trim(),
          address: address?.trim() || null,
        },
      });
      storeId = store.id;
    }

    if (ownerEmail?.trim() && ownerPassword) {
      const existing = await saasPrisma.user.findUnique({
        where: { email: ownerEmail.trim().toLowerCase() },
      });
      if (existing) {
        await saasPrisma.organization.delete({ where: { id: org.id } });
        if (storeId) await saasPrisma.store.delete({ where: { id: storeId } });
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(ownerPassword, 10);
      const user = await saasPrisma.user.create({
        data: {
          organizationId: org.id,
          name: (ownerName || ownerEmail).trim(),
          email: ownerEmail.trim().toLowerCase(),
          password: hashedPassword,
          role: "owner",
        },
      });

      if (storeId) {
        await saasPrisma.userStore.create({
          data: { userId: user.id, storeId },
        });
      }
    }

    const created = await saasPrisma.organization.findUnique({
      where: { id: org.id },
      include: {
        stores: true,
        users: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    res.status(201).json(created);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create organization";
    console.error("[admin create org]", error);
    res.status(400).json({ message: msg });
  }
});

router.get("/stores", async (_req: AuthRequest, res) => {
  try {
    const stores = await saasPrisma.store.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, organizationId: true, businessMode: true },
    });
    res.json(stores);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch stores" });
  }
});

router.get("/reports/product-ranking", async (req: AuthRequest, res) => {
  try {
    const storeIdFilter = parseAdminStoreIdQuery(req.query.storeId);
    const fromDate = parseQueryDate(req.query.from, new Date(0));
    const toDate = parseQueryDate(req.query.to, new Date());

    const storeIds = storeIdFilter
      ? [storeIdFilter]
      : (await saasPrisma.store.findMany({ select: { id: true } })).map((s) => s.id);
    if (storeIds.length === 0) {
      return res.json([]);
    }

    const itemSelect = {
      productId: true,
      menuItemId: true,
      productName: true,
      variantId: true,
      variantName: true,
      quantity: true,
      subtotal: true,
    } as const;

    const saleWhereBase = {
      status: { not: "void" as const },
      createdAt: { gte: fromDate, lte: toDate },
    };

    // SQLite: `sale: { storeId: { in: [...many] } }` on SaleItem can devolve into a very slow/hanging plan.
    // One query per store matches the fast single-store path; merge in memory.
    const items =
      storeIds.length === 1
        ? await saasPrisma.saleItem.findMany({
            where: { sale: { storeId: storeIds[0], ...saleWhereBase } },
            select: itemSelect,
          })
        : (
            await Promise.all(
              storeIds.map((sid) =>
                saasPrisma.saleItem.findMany({
                  where: { sale: { storeId: sid, ...saleWhereBase } },
                  select: itemSelect,
                })
              )
            )
          ).flat();

    const map = new Map<
      string,
      { productName: string; variantId: string | null; variantName: string | null; quantity: number; revenue: number }
    >();
    for (const item of items) {
      let key: string | null = null;
      if (item.productId) {
        key = `p|${item.productId}|${item.variantId ?? ""}`;
      } else if (item.menuItemId) {
        key = `m|${item.menuItemId}`;
      }
      if (!key) continue;

      const existing = map.get(key);
      const qty = item.quantity ?? 0;
      const rev = item.subtotal ?? 0;
      if (existing) {
        existing.quantity += qty;
        existing.revenue += rev;
      } else {
        map.set(key, {
          productName: item.productName,
          variantId: item.variantId ?? null,
          variantName: item.variantName ?? null,
          quantity: qty,
          revenue: rev,
        });
      }
    }

    const ranked = Array.from(map.entries())
      .map(([key, data]) => {
        const parts = key.split("|");
        if (parts[0] === "m") {
          return {
            productId: null as string | null,
            menuItemId: parts[1],
            variantId: null as string | null,
            productName: data.productName,
            variantName: data.variantName,
            quantity: data.quantity,
            revenue: data.revenue,
          };
        }
        return {
          productId: parts[1],
          menuItemId: null as string | null,
          variantId: parts[2] || null,
          productName: data.productName,
          variantName: data.variantName,
          quantity: data.quantity,
          revenue: data.revenue,
        };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .map((r, i) => ({ rank: i + 1, ...r }));

    res.json(ranked);
  } catch (error: unknown) {
    console.error("[product-ranking]", error);
    res.status(500).json({ message: "Failed to fetch product ranking" });
  }
});

router.get("/reports/product-ranking/drilldown", async (req: AuthRequest, res) => {
  try {
    const { productId, variantId, menuItemId, from, to } = req.query as {
      productId?: string;
      variantId?: string;
      menuItemId?: string;
      from?: string;
      to?: string;
    };
    const menuItem =
      menuItemId && menuItemId !== "null" && menuItemId !== "undefined" ? menuItemId : null;
    if (!menuItem && !productId) {
      return res.status(400).json({ message: "productId or menuItemId is required" });
    }
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date();

    // Filter by variantId only when explicitly provided (for variant-specific rows)
    const variantFilter =
      !menuItem && variantId && variantId !== "null" && variantId !== "undefined"
        ? { variantId }
        : {};

    const items = await saasPrisma.saleItem.findMany({
      where: {
        ...(menuItem ? { menuItemId: menuItem } : { productId: productId!, ...variantFilter }),
        sale: {
          status: { not: "void" },
          createdAt: { gte: fromDate, lte: toDate },
        },
      },
      select: {
        quantity: true,
        subtotal: true,
        sale: { select: { storeId: true, store: { select: { name: true } } } },
      },
    });

    const storeMap = new Map<string, { storeName: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const sid = item.sale.storeId;
      const name = item.sale.store.name;
      const existing = storeMap.get(sid);
      const qty = item.quantity ?? 0;
      const rev = item.subtotal ?? 0;
      if (existing) {
        existing.quantity += qty;
        existing.revenue += rev;
      } else {
        storeMap.set(sid, { storeName: name, quantity: qty, revenue: rev });
      }
    }

    const ranked = Array.from(storeMap.entries())
      .map(([storeId, data]) => ({ storeId, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .map((r, i) => ({ rank: i + 1, ...r }));

    res.json(ranked);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch store drilldown" });
  }
});

router.get("/overview", async (_req: AuthRequest, res) => {
  try {
    const [orgCount, userCount, storeCount, recentOrgs] = await Promise.all([
      saasPrisma.organization.count(),
      saasPrisma.user.count({ where: { role: { not: "super_admin" } } }),
      saasPrisma.store.count(),
      saasPrisma.organization.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { stores: true, users: true } },
        },
      }),
    ]);

    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const [billingDueSoon, planCounts] = await Promise.all([
      saasPrisma.organization.findMany({
        where: {
          AND: [
            { billingDueDate: { not: null } },
            { billingDueDate: { gte: now, lte: in30Days } },
          ],
        },
        orderBy: { billingDueDate: "asc" },
        take: 10,
      }),
      (saasPrisma.$queryRaw<
        [{ freeCount: bigint; proCount: bigint; enterpriseCount: bigint; suspendedCount: bigint }]
      >`
        SELECT
          SUM(CASE WHEN LOWER(plan) = 'free' THEN 1 ELSE 0 END) as freeCount,
          SUM(CASE WHEN LOWER(plan) = 'pro' THEN 1 ELSE 0 END) as proCount,
          SUM(CASE WHEN LOWER(plan) = 'enterprise' THEN 1 ELSE 0 END) as enterpriseCount,
          SUM(CASE WHEN LOWER(plan) = 'suspended' THEN 1 ELSE 0 END) as suspendedCount
        FROM "Organization"
      `).then((r) => ({
        freeCount: Number(r[0]?.freeCount ?? 0),
        proCount: Number(r[0]?.proCount ?? 0),
        enterpriseCount: Number(r[0]?.enterpriseCount ?? 0),
        suspendedCount: Number(r[0]?.suspendedCount ?? 0),
      })),
    ]);

    res.json({
      orgCount,
      userCount,
      storeCount,
      recentOrgs: recentOrgs.map((o) => ({
        id: o.id,
        name: o.name,
        plan: o.plan,
        billingDueDate: o.billingDueDate,
        trialEndsAt: o.trialEndsAt,
        createdAt: o.createdAt,
        storeCount: o._count.stores,
        userCount: o._count.users,
      })),
      billingDueSoon: billingDueSoon.map((o) => ({
        id: o.id,
        name: o.name,
        plan: o.plan,
        billingDueDate: o.billingDueDate,
      })),
      ...planCounts,
    });
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch overview" });
  }
});

router.get("/organizations", async (req: AuthRequest, res) => {
  try {
    const { search, plan } = req.query as { search?: string; plan?: string };
    const where: Record<string, unknown>[] = [];
    if (search) {
      where.push({
        OR: [
          { name: { contains: search } },
          { id: { contains: search } },
        ],
      });
    }
    if (plan && ["free", "pro", "enterprise", "suspended"].includes(plan.toLowerCase())) {
      const planLower = plan.toLowerCase();
      where.push({
        OR: [
          { plan: planLower },
          { plan: planLower.charAt(0).toUpperCase() + planLower.slice(1) },
        ],
      });
    }
    const orgs = await saasPrisma.organization.findMany({
      where: where.length > 0 ? { AND: where } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { stores: true, users: true } },
      },
    });

    res.json(
      orgs.map((o) => ({
        id: o.id,
        name: o.name,
        plan: o.plan,
        phone: o.phone,
        email: o.email,
        address: o.address,
        stripeCustomerId: o.stripeCustomerId,
        billingDueDate: o.billingDueDate,
        createdAt: o.createdAt,
        storeCount: o._count.stores,
        userCount: o._count.users,
      }))
    );
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch organizations" });
  }
});

router.get("/organizations/:id", async (req: AuthRequest, res) => {
  try {
    const org = await saasPrisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        stores: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            storeAccess: { select: { storeId: true } },
          },
        },
      },
    });
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }
    const { users, ...rest } = org;
    res.json({
      ...rest,
      users: users.map((u) => {
        const { password: _p, storeAccess, ...uRest } = u as typeof u & {
          password?: string;
          storeAccess: { storeId: string }[];
        };
        return { ...uRest, storeIds: storeAccess.map((a) => a.storeId) };
      }),
    });
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch organization" });
  }
});

router.patch("/organizations/:id", async (req: AuthRequest, res) => {
  try {
    const { name, plan, suspended, billingDueDate, phone, email, address } = req.body as {
      name?: string;
      plan?: string;
      suspended?: boolean;
      billingDueDate?: string | null;
      phone?: string;
      email?: string;
      address?: string;
    };
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (plan !== undefined) updateData.plan = plan;
    if (suspended !== undefined) updateData.plan = suspended ? "suspended" : "free";
    if (billingDueDate !== undefined)
      updateData.billingDueDate = billingDueDate && billingDueDate.trim() ? new Date(billingDueDate) : null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (address !== undefined) {
      updateData.address = address?.trim() || null;
      // Sync address to all stores in this org
      await saasPrisma.store.updateMany({
        where: { organizationId: req.params.id },
        data: { address: address?.trim() || null },
      });
    }

    const org = await saasPrisma.organization.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(org);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to update organization" });
  }
});

router.delete("/api/admin/organizations/:id", async (req: AuthRequest, res) => {
  try {
    await saasPrisma.organization.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to delete organization" });
  }
});

router.post("/api/admin/organizations/:id/users", async (req: AuthRequest, res) => {
  try {
    const orgId = req.params.id;
    const { name, email, password, role, storeIds } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      storeIds?: string[];
    };

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const org = await saasPrisma.organization.findUnique({
      where: { id: orgId },
      include: { stores: true },
    });
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const existing = await saasPrisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const validStoreIds = (storeIds || []).filter((sid) =>
      org.stores.some((s) => s.id === sid)
    );
    const storesToAssign = validStoreIds.length > 0 ? validStoreIds : org.stores.map((s) => s.id);

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await saasPrisma.user.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: (role || "cashier") as string,
      },
    });

    for (const storeId of storesToAssign) {
      await saasPrisma.userStore.create({
        data: { userId: user.id, storeId },
      });
    }

    const { password: _p, ...sanitized } = user;
    res.status(201).json(sanitized);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create user";
    console.error("[admin create user]", error);
    res.status(400).json({ message: msg });
  }
});

router.patch("/api/admin/organizations/:orgId/users/:userId", async (req: AuthRequest, res) => {
  try {
    const { orgId, userId } = req.params;
    const { name, email, password, role, storeIds } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      storeIds?: string[];
    };

    const user = await saasPrisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const org = await saasPrisma.organization.findUnique({
      where: { id: orgId },
      include: { stores: true },
    });
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined && name.trim()) updateData.name = name.trim();
    if (email !== undefined && email.trim()) {
      const lower = email.trim().toLowerCase();
      const existing = await saasPrisma.user.findUnique({
        where: { email: lower },
      });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ message: "Email already registered" });
      }
      updateData.email = lower;
    }
    if (password !== undefined && password.length > 0) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (role !== undefined) updateData.role = role;

    const updated = await saasPrisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    if (storeIds !== undefined) {
      await saasPrisma.userStore.deleteMany({ where: { userId } });
      const validStoreIds = storeIds.filter((sid) => org.stores.some((s) => s.id === sid));
      const toAssign = validStoreIds.length > 0 ? validStoreIds : org.stores.map((s) => s.id);
      for (const storeId of toAssign) {
        await saasPrisma.userStore.create({
          data: { userId, storeId },
        });
      }
    }

    const { password: _p, ...sanitized } = updated;
    res.json(sanitized);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update user";
    console.error("[admin update user]", error);
    res.status(400).json({ message: msg });
  }
});

router.delete("/api/admin/organizations/:orgId/users/:userId", async (req: AuthRequest, res) => {
  try {
    const { orgId, userId } = req.params;
    const user = await saasPrisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    await saasPrisma.userStore.deleteMany({ where: { userId } });
    await saasPrisma.user.delete({ where: { id: userId } });
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to delete user" });
  }
});

// Store CRUD (admin)
router.post("/organizations/:orgId/stores", async (req: AuthRequest, res) => {
  try {
    const orgId = req.params.orgId;
    const { name, address, businessMode: rawMode } = req.body as {
      name?: string;
      address?: string;
      businessMode?: string;
    };
    if (!name?.trim()) {
      return res.status(400).json({ message: "Store name is required" });
    }
    const org = await saasPrisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, address: true },
    });
    if (!org) return res.status(404).json({ message: "Organization not found" });
    const businessMode = rawMode === "fnb" ? "fnb" : "retail";
    const store = await saasPrisma.store.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        address: address?.trim() || org.address || null,
        businessMode,
      },
      select: { id: true, name: true, address: true, createdAt: true, businessMode: true },
    });
    res.status(201).json(store);
  } catch (error: unknown) {
    console.error("[admin create store]", error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to create store" });
  }
});

router.patch("/organizations/:orgId/stores/:storeId", async (req: AuthRequest, res) => {
  try {
    const { orgId, storeId } = req.params;
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "businessMode")) {
      return res.status(400).json({
        message: "Store type (retail vs F&B) cannot be changed. Create a new store instead.",
      });
    }
    const { name, address } = req.body as { name?: string; address?: string };
    const existing = await saasPrisma.store.findFirst({
      where: { id: storeId, organizationId: orgId },
    });
    if (!existing) return res.status(404).json({ message: "Store not found" });
    const store = await saasPrisma.store.update({
      where: { id: storeId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
      },
      select: { id: true, name: true, address: true, createdAt: true, businessMode: true },
    });
    res.json(store);
  } catch (error: unknown) {
    console.error("[admin update store]", error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to update store" });
  }
});

router.delete("/organizations/:orgId/stores/:storeId", async (req: AuthRequest, res) => {
  try {
    const { orgId, storeId } = req.params;
    const existing = await saasPrisma.store.findFirst({
      where: { id: storeId, organizationId: orgId },
    });
    if (!existing) return res.status(404).json({ message: "Store not found" });
    await saasPrisma.store.delete({ where: { id: storeId } });
    res.status(204).send();
  } catch (error: unknown) {
    console.error("[admin delete store]", error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to delete store" });
  }
});

router.post("/api/admin/organizations/:orgId/notifications", async (req: AuthRequest, res) => {
  try {
    const orgId = req.params.orgId;
    const { message, type, expiresAt } = req.body as {
      message?: string;
      type?: string;
      expiresAt?: string;
    };

    if (!message?.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const org = await saasPrisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const notification = await saasPrisma.organizationNotification.create({
      data: {
        organizationId: orgId,
        message: message.trim(),
        type: type === "warning" || type === "urgent" ? type : "info",
        expiresAt: expiresAt && expiresAt.trim() ? new Date(expiresAt) : null,
      },
    });

    res.status(201).json(notification);
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Failed to create notification";
    console.error("[admin create notification]", error);
    res.status(500).json({ message: msg });
  }
});

router.post("/seed-demo", async (_req: AuthRequest, res) => {
  try {
    const result = await runSeedDemo();
    res.json({
      message: "Demo data seeded successfully",
      ...result,
      password: "password123",
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Failed to seed demo data";
    console.error("[admin seed-demo]", error);
    res.status(500).json({ message: msg });
  }
});

export default router;
