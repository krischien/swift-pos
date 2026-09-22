import { randomBytes } from "node:crypto";
import { saasPrisma } from "../db.js";

export interface CustomerInput {
  id?: string;
  qrToken?: string;
  name: string;
  phone?: string | null;
  nickname?: string | null;
  address?: string | null;
}

const clean = (value?: string | null) => value?.trim() || null;
const normalizeName = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const normalizePhone = (value?: string | null) =>
  clean(value)?.replace(/[^\d+]/g, "") || null;

export async function requireCylinderTracking(storeId: string) {
  const store = await saasPrisma.store.findUnique({
    where: { id: storeId },
    select: { enableCylinderTracking: true, collectCylinderDeposits: true },
  });
  if (!store) throw new Error("Store not found");
  if (!store.enableCylinderTracking) throw new Error("Canister Monitoring is disabled");
  return store;
}

function validate(input: CustomerInput) {
  const name = input.name?.trim();
  if (!name) throw new Error("Customer name is required");
  if (name.length > 160) throw new Error("Customer name is too long");
  return {
    name,
    normalizedName: normalizeName(name),
    phone: clean(input.phone),
    normalizedPhone: normalizePhone(input.phone),
    nickname: clean(input.nickname),
    address: clean(input.address),
  };
}

export async function listCustomers(
  storeId: string,
  options: { search?: string; page?: number; pageSize?: number; archived?: boolean } = {},
) {
  await requireCylinderTracking(storeId);
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 25)));
  const q = options.search?.trim();
  const normalized = q ? normalizeName(q) : "";
  const phone = q ? normalizePhone(q) : null;
  const where = {
    storeId,
    archived: options.archived ?? false,
    ...(q
      ? {
          OR: [
            { normalizedName: { contains: normalized } },
            { normalizedPhone: { contains: phone || normalized } },
            { nickname: { contains: q } },
            { address: { contains: q } },
          ],
        }
      : {}),
  };
  const [items, total] = await saasPrisma.$transaction([
    saasPrisma.customer.findMany({
      where,
      orderBy: [{ isSuki: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    saasPrisma.customer.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function recentCustomers(storeId: string, limit = 12) {
  await requireCylinderTracking(storeId);
  const take = Math.min(50, Math.max(1, limit));
  const recentSales = await saasPrisma.sale.findMany({
    where: { storeId, customerId: { not: null }, status: { not: "void" } },
    select: { customerId: true },
    distinct: ["customerId"],
    orderBy: { createdAt: "desc" },
    take,
  });
  const ids = recentSales.flatMap((sale) => sale.customerId ? [sale.customerId] : []);
  const active = ids.length
    ? await saasPrisma.customer.findMany({ where: { storeId, id: { in: ids }, archived: false } })
    : [];
  const byId = new Map(active.map((customer) => [customer.id, customer]));
  const ordered = ids.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
  if (ordered.length >= take) return ordered;
  const fallback = await saasPrisma.customer.findMany({
    where: { storeId, archived: false, id: { notIn: ordered.map((customer) => customer.id) } },
    orderBy: { updatedAt: "desc" },
    take: take - ordered.length,
  });
  return [...ordered, ...fallback];
}

export async function getCustomerByQr(storeId: string, qrToken: string) {
  await requireCylinderTracking(storeId);
  return saasPrisma.customer.findFirst({ where: { storeId, qrToken, archived: false } });
}

export async function createCustomer(storeId: string, input: CustomerInput) {
  await requireCylinderTracking(storeId);
  if (input.id) {
    const existing = await saasPrisma.customer.findFirst({ where: { id: input.id, storeId } });
    if (existing) return existing;
  }
  const suppliedToken = input.qrToken?.trim();
  if (suppliedToken && (!/^[A-Za-z0-9_-]+$/.test(suppliedToken) || suppliedToken.length < 24)) {
    throw new Error("Invalid customer QR token");
  }
  const customerData = validate(input);
  if (customerData.normalizedPhone) {
    const duplicate = await saasPrisma.customer.findFirst({
      where: { storeId, archived: false, normalizedPhone: customerData.normalizedPhone },
      select: { id: true },
    });
    if (duplicate) throw new Error("An active customer already uses this phone number");
  }
  return saasPrisma.customer.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      storeId,
      ...customerData,
      qrToken: suppliedToken ?? randomBytes(24).toString("base64url"),
    },
  });
}

export async function updateCustomer(storeId: string, id: string, input: CustomerInput) {
  await requireCylinderTracking(storeId);
  const existing = await saasPrisma.customer.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Customer not found");
  const customerData = validate(input);
  if (customerData.normalizedPhone) {
    const duplicate = await saasPrisma.customer.findFirst({
      where: {
        storeId,
        archived: false,
        normalizedPhone: customerData.normalizedPhone,
        id: { not: id },
      },
      select: { id: true },
    });
    if (duplicate) throw new Error("An active customer already uses this phone number");
  }
  return saasPrisma.customer.update({ where: { id }, data: customerData });
}

export async function archiveCustomer(storeId: string, id: string, archived = true) {
  await requireCylinderTracking(storeId);
  const existing = await saasPrisma.customer.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Customer not found");
  return saasPrisma.customer.update({ where: { id }, data: { archived } });
}

export async function setSuki(
  storeId: string,
  id: string,
  actorId: string,
  enabled: boolean,
  note?: string | null,
) {
  await requireCylinderTracking(storeId);
  const existing = await saasPrisma.customer.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Customer not found");
  return saasPrisma.customer.update({
    where: { id },
    data: enabled
      ? {
          isSuki: true,
          sukiAssignedAt: new Date(),
          sukiAssignedById: actorId,
          sukiNote: clean(note),
        }
      : { isSuki: false, sukiAssignedAt: null, sukiAssignedById: null, sukiNote: null },
  });
}

export async function getCustomerDetail(storeId: string, id: string) {
  await requireCylinderTracking(storeId);
  const customer = await saasPrisma.customer.findFirst({
    where: { id, storeId },
    include: {
      sales: { where: { status: { not: "void" } }, orderBy: { createdAt: "desc" }, take: 100 },
      cylinderLoans: {
        orderBy: { outAt: "desc" },
        include: { product: { select: { id: true, name: true, cylinderSize: true } }, returns: true },
      },
      sukiAssignedBy: { select: { id: true, name: true } },
    },
  });
  if (!customer) return null;

  const since = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const sales180 = customer.sales.filter((s) => s.createdAt.getTime() >= since);
  let returnedQuantity = 0;
  let writtenOffQuantity = 0;
  let weightedReturnDays = 0;
  let weightedReturnQuantity = 0;
  for (const loan of customer.cylinderLoans) {
    const eventQuantity = loan.returns.reduce((sum, event) => sum + event.quantity, 0);
    const resolvedReturned = Math.min(
      loan.quantity,
      eventQuantity > 0
        ? eventQuantity
        : loan.status === "returned"
          ? (loan.returnedQuantity || loan.quantity)
          : loan.returnedQuantity,
    );
    returnedQuantity += resolvedReturned;
    if (loan.status === "written_off") {
      writtenOffQuantity += Math.max(0, loan.quantity - resolvedReturned);
    }
    for (const event of loan.returns) {
      weightedReturnDays +=
        Math.max(0, (event.returnedAt.getTime() - loan.outAt.getTime()) / 86_400_000) *
        event.quantity;
      weightedReturnQuantity += event.quantity;
    }
    if (!loan.returns.length && loan.status === "returned" && loan.returnedAt && resolvedReturned > 0) {
      weightedReturnDays +=
        Math.max(0, (loan.returnedAt.getTime() - loan.outAt.getTime()) / 86_400_000) *
        resolvedReturned;
      weightedReturnQuantity += resolvedReturned;
    }
  }
  const completedOutcomes = returnedQuantity + writtenOffQuantity;
  const avgReturnDays = weightedReturnQuantity
    ? weightedReturnDays / weightedReturnQuantity
    : null;

  return {
    ...customer,
    evidence: {
      lastPurchaseAt: customer.sales[0]?.createdAt ?? null,
      frequency180d: sales180.length,
      monetary180d: sales180.reduce((sum, sale) => sum + sale.total, 0),
      completedOutcomes,
      reliableQualification: completedOutcomes >= 3,
      returnRate: completedOutcomes ? returnedQuantity / completedOutcomes : null,
      avgReturnDays,
      openQuantity: customer.cylinderLoans
        .filter((l) => l.status === "out" || l.status === "partial")
        .reduce((sum, l) => sum + l.quantity - l.returnedQuantity, 0),
      writeoffs: writtenOffQuantity,
    },
  };
}
