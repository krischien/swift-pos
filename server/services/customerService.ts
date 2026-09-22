import { randomBytes } from "node:crypto";
import { prisma } from "../db";

const normalizedName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const normalizedPhone = (value?: string | null) => value?.replace(/[^\d+]/g, "") || null;

export type SoloCustomerInput = {
  name: string;
  phone?: string | null;
  nickname?: string | null;
  address?: string | null;
};

const data = (input: SoloCustomerInput) => {
  const name = input.name?.trim();
  if (!name) throw new Error("Customer name is required");
  return {
    name,
    normalizedName: normalizedName(name),
    phone: input.phone?.trim() || null,
    normalizedPhone: normalizedPhone(input.phone),
    nickname: input.nickname?.trim() || null,
    address: input.address?.trim() || null,
  };
};

export async function listCustomers(search?: string, page = 1, pageSize = 25) {
  const q = search?.trim();
  const where = {
    storeId: "solo",
    archived: false,
    ...(q ? {
      OR: [
        { normalizedName: { contains: normalizedName(q) } },
        { normalizedPhone: { contains: normalizedPhone(q) || q } },
        { nickname: { contains: q } },
        { address: { contains: q } },
      ],
    } : {}),
  };
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      orderBy: [{ isSuki: "desc" }, { updatedAt: "desc" }],
      skip: (safePage - 1) * safeSize,
      take: safeSize,
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, total, page: safePage, pageSize: safeSize };
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, storeId: "solo" },
    include: {
      sales: { where: { status: { not: "void" } }, orderBy: { createdAt: "desc" } },
      cylinderLoans: { orderBy: { outAt: "desc" }, include: { returns: true, product: true } },
    },
  });
  if (!customer) return null;
  const since = Date.now() - 180 * 86_400_000;
  const sales180 = customer.sales.filter((sale) => sale.createdAt.getTime() >= since);
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
  return {
    ...customer,
    evidence: {
      lastPurchaseAt: customer.sales[0]?.createdAt ?? null,
      frequency180d: sales180.length,
      monetary180d: sales180.reduce((sum, sale) => sum + sale.total, 0),
      completedOutcomes,
      reliableQualification: completedOutcomes >= 3,
      returnRate: completedOutcomes ? returnedQuantity / completedOutcomes : null,
      avgReturnDays: weightedReturnQuantity ? weightedReturnDays / weightedReturnQuantity : null,
      openQuantity: customer.cylinderLoans
        .filter((loan) => ["out", "partial"].includes(loan.status))
        .reduce((sum, loan) => sum + loan.quantity - loan.returnedQuantity, 0),
      writeoffs: writtenOffQuantity,
    },
  };
}

export const getCustomerByQr = (qrToken: string) =>
  prisma.customer.findFirst({ where: { qrToken, storeId: "solo", archived: false } });

export async function createCustomer(input: SoloCustomerInput) {
  const customerData = data(input);
  if (customerData.normalizedPhone) {
    const duplicate = await prisma.customer.findFirst({
      where: {
        storeId: "solo",
        archived: false,
        normalizedPhone: customerData.normalizedPhone,
      },
      select: { id: true },
    });
    if (duplicate) throw new Error("An active customer already uses this phone number");
  }
  return prisma.customer.create({
    data: { storeId: "solo", ...customerData, qrToken: randomBytes(24).toString("base64url") },
  });
}

export async function updateCustomer(id: string, input: SoloCustomerInput) {
  const customer = await prisma.customer.findFirst({ where: { id, storeId: "solo" } });
  if (!customer) throw new Error("Customer not found");
  const customerData = data(input);
  if (customerData.normalizedPhone) {
    const duplicate = await prisma.customer.findFirst({
      where: {
        storeId: "solo",
        archived: false,
        normalizedPhone: customerData.normalizedPhone,
        id: { not: id },
      },
      select: { id: true },
    });
    if (duplicate) throw new Error("An active customer already uses this phone number");
  }
  return prisma.customer.update({ where: { id }, data: customerData });
}

export async function archiveCustomer(id: string, archived = true) {
  const customer = await prisma.customer.findFirst({ where: { id, storeId: "solo" } });
  if (!customer) throw new Error("Customer not found");
  return prisma.customer.update({ where: { id }, data: { archived } });
}

export async function setSuki(id: string, actorId: string, enabled: boolean, note?: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor || !["admin", "owner"].includes(actor.role)) throw new Error("Admin access required");
  return prisma.customer.update({
    where: { id },
    data: enabled
      ? { isSuki: true, sukiAssignedAt: new Date(), sukiAssignedById: actorId, sukiNote: note?.trim() || null }
      : { isSuki: false, sukiAssignedAt: null, sukiAssignedById: null, sukiNote: null },
  });
}
