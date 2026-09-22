import { saasPrisma } from "../db.js";
import { changePhpFromCents, paymentCoversTotal, phpToCents } from "../../utils/money.js";
import { processCylinderLinesOnSale, voidCylinderLoansForSale } from "./cylinderService.js";

export interface CartItemInput {
  cylinderLoanId?: string;
  productId?: string;
  menuItemId?: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
  subtotal: number;
  /** Exchange: customer brought empty canister — no loan created */
  broughtEmpty?: boolean;
  broughtEmptyQuantity?: number;
}

export interface CreateSaleInput {
  storeId: string;
  cashierId: string;
  cashierName: string;
  total: number;
  paymentMethod?: string;
  amountReceived: number;
  change: number;
  items: CartItemInput[];
  ticketNumber?: string;
  gcashTransactionId?: string;
  /** When set (e.g. demo seed), persists on the sale row for reports/charts */
  createdAt?: Date;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
}

function consumptionUnits(recipeQty: number, saleQty: number, wastagePercent: number | null): number {
  const w = 1 + (wastagePercent ?? 0) / 100;
  return Math.max(0, Math.ceil(recipeQty * saleQty * w));
}

async function validateCartForStoreMode(storeId: string, items: CartItemInput[]) {
  const store = await saasPrisma.store.findFirst({ where: { id: storeId } });
  if (!store) throw new Error("Store not found");
  const mode = store.businessMode ?? "retail";
  for (const item of items) {
    const hasP = Boolean(item.productId);
    const hasM = Boolean(item.menuItemId);
    if (hasP === hasM) {
      throw new Error("Each line must have exactly one of productId or menuItemId");
    }
    if (mode === "retail" && hasM) {
      throw new Error("This store is retail-only; menu items are not sold here");
    }
    if (mode === "fnb" && hasP) {
      throw new Error("This is a Food & Beverage store; use menu items on the POS, not products");
    }
  }
  return store;
}

export async function createSale(input: CreateSaleInput) {
  const { storeId, cashierId, cashierName, amountReceived, items } = input;
  const total = input.total;
  const store = await validateCartForStoreMode(storeId, items);
  const productIds = [...new Set(items.flatMap((item) => item.productId ? [item.productId] : []))];
  const cylinderProducts = productIds.length
    ? await saasPrisma.product.findMany({
        where: { storeId, id: { in: productIds }, tracksCylinder: true },
        select: { id: true, depositAmount: true },
      })
    : [];
  if (cylinderProducts.length && !store.enableCylinderTracking) {
    throw new Error("Canister Monitoring is disabled");
  }
  let linkedCustomer: { name: string; phone: string | null } | null = null;
  if (input.customerId) {
    linkedCustomer = await saasPrisma.customer.findFirst({
      where: { id: input.customerId, storeId, archived: false },
      select: { name: true, phone: true },
    });
    if (!linkedCustomer) throw new Error("Customer not found");
  }
  const cylinderById = new Map(cylinderProducts.map((p) => [p.id, p]));
  const outstandingCylinderQuantity = items.reduce((sum, item) => {
    if (!item.productId || !cylinderById.has(item.productId)) return sum;
    const emptyQty = Math.min(
      item.quantity,
      Math.max(0, Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0))),
    );
    return sum + Math.max(0, item.quantity - emptyQty);
  }, 0);
  if (outstandingCylinderQuantity > 0 && !input.customerId) {
    throw new Error("Customer is required when a canister remains with the customer");
  }
  const depositAmount = items.reduce((sum, item) => {
    const product = item.productId ? cylinderById.get(item.productId) : undefined;
    if (!product || !store.collectCylinderDeposits) return sum;
    const emptyQty = Math.min(
      item.quantity,
      Math.max(0, Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0))),
    );
    return sum + Math.max(0, item.quantity - emptyQty) * product.depositAmount;
  }, 0);
  const amountDue = total + depositAmount;
  const receivedCents = phpToCents(amountReceived);
  const dueCents = phpToCents(amountDue);
  if (!paymentCoversTotal(amountReceived, amountDue)) {
    throw new Error("Amount received is less than total due");
  }
  const change = changePhpFromCents(receivedCents, dueCents);

  return saasPrisma.$transaction(async (tx) => {
    const ticketNumber =
      input.ticketNumber ||
      `T-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)
        .toString()
        .padStart(3, "0")}`;

    const sale = await tx.sale.create({
      data: {
        storeId,
        ticketNumber,
        cashierId,
        cashierName,
        total,
        depositAmount,
        amountDue,
        customerId: input.customerId ?? null,
        paymentMethod: input.paymentMethod ?? "cash",
        amountReceived,
        change,
        gcashTransactionId: input.gcashTransactionId ?? null,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
    });

    const cylinderLines: Array<{
      productId: string;
      loanId?: string;
      quantity: number;
      saleItemId?: string;
      broughtEmpty?: boolean;
      broughtEmptyQuantity?: number;
    }> = [];

    for (const item of items) {
      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId ?? null,
          menuItemId: item.menuItemId ?? null,
          variantId: item.variantId ?? null,
          productName: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          broughtEmptyQuantity: Math.max(
            0,
            Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0)),
          ),
        },
      });

      if (item.productId) {
        cylinderLines.push({
          productId: item.productId,
          loanId: item.cylinderLoanId,
          quantity: item.quantity,
          saleItemId: saleItem.id,
          broughtEmptyQuantity: Math.max(
            0,
            Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0)),
          ),
        });
      }

      if (item.menuItemId) {
        const menuItem = await tx.menuItem.findFirst({
          where: { id: item.menuItemId, storeId },
          include: { recipeLines: true },
        });
        if (!menuItem) throw new Error("Menu item not found");
        if (menuItem.status !== "active") throw new Error(`Menu item is not active: ${menuItem.name}`);

        for (const line of menuItem.recipeLines) {
          const dec = consumptionUnits(line.quantity, item.quantity, line.wastagePercent);
          if (dec <= 0) continue;
          const ing = await tx.ingredient.findFirst({
            where: { id: line.ingredientId, storeId },
          });
          if (!ing) throw new Error("Recipe references a missing ingredient");
          if (ing.stock < dec) {
            throw new Error(`Insufficient stock for ingredient: ${ing.name}`);
          }
          await tx.ingredient.update({
            where: { id: line.ingredientId },
            data: { stock: { decrement: dec } },
          });
        }
      } else if (item.productId) {
        if (item.variantId) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });
        }
      }
    }

    if (cylinderLines.length) {
      await processCylinderLinesOnSale(tx, {
        storeId,
        saleId: sale.id,
        customerId: input.customerId,
        customerName: linkedCustomer?.name ?? input.customerName,
        customerPhone: linkedCustomer?.phone ?? input.customerPhone,
        collectDeposits: store.collectCylinderDeposits,
        lines: cylinderLines,
      });
    }

    return tx.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: true,
        cashier: true,
        customer: true,
      },
    });
  });
}

export type SaleVoidFilter = "active" | "voided" | "all";

export interface ListSalesOptions {
  from?: Date;
  to?: Date;
  /** active = non-voided (default); voided = void only; all = include both */
  voidFilter?: SaleVoidFilter;
}

export async function countVoidedSales(storeId: string, options: ListSalesOptions = {}) {
  const { from, to } = options;
  return saasPrisma.sale.count({
    where: {
      storeId,
      status: "void",
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
  });
}

export async function listSales(storeId: string, options: ListSalesOptions = {}) {
  const { from, to } = options;
  const vf = options.voidFilter ?? "active";

  const statusWhere =
    vf === "voided"
      ? { status: "void" as const }
      : vf === "all"
        ? {}
        : { status: { not: "void" } };

  return saasPrisma.sale.findMany({
    where: {
      storeId,
      ...statusWhere,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: {
      items: true,
      cashier: true,
      voidedBy: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getSaleById(id: string, storeId: string) {
  return saasPrisma.sale.findFirst({
    where: { id, storeId },
    include: {
      items: true,
      cashier: true,
      voidedBy: true,
    },
  });
}

export interface VoidSaleActor {
  userId: string;
  role: string;
  name: string;
}

/** UTC calendar day boundary for "today" void rules. */
function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function assertCanVoidSale(
  sale: { cashierId: string | null; createdAt: Date; status?: string },
  actor: VoidSaleActor,
) {
  if (actor.role === "owner") return;

  if (actor.role === "cashier") {
    if (sale.cashierId !== actor.userId) {
      throw new Error("Forbidden: cashiers can only void their own sales");
    }
    if (!isSameUtcDay(sale.createdAt, new Date())) {
      throw new Error("Forbidden: cashiers can only void sales from today");
    }
    return;
  }

  throw new Error("Forbidden: you are not allowed to void sales");
}

export async function voidSale(id: string, storeId: string, actor: VoidSaleActor) {
  const sale = await saasPrisma.sale.findFirst({
    where: { id, storeId },
    include: { items: true, cylinderLoans: true },
  });
  if (!sale) return null;
  if ((sale as { status?: string }).status === "void") {
    throw new Error("Sale is already voided");
  }

  assertCanVoidSale(sale, actor);
  if (sale.cylinderLoans.some((loan) => loan.returnedQuantity > 0)) {
    throw new Error("Cannot void a sale after canister returns have been recorded");
  }

  const voidedAt = new Date();

  return saasPrisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      if (item.menuItemId) {
        const menuItem = await tx.menuItem.findFirst({
          where: { id: item.menuItemId, storeId },
          include: { recipeLines: true },
        });
        if (menuItem) {
          for (const line of menuItem.recipeLines) {
            const dec = consumptionUnits(line.quantity, item.quantity, line.wastagePercent);
            if (dec <= 0) continue;
            await tx.ingredient.update({
              where: { id: line.ingredientId },
              data: { stock: { increment: dec } },
            });
          }
        }
      } else if (item.productId) {
        if (item.variantId) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    }

    await voidCylinderLoansForSale(tx, id);

    return tx.sale.update({
      where: { id },
      data: {
        status: "void",
        voidedAt,
        voidedById: actor.userId,
        voidedByName: actor.name,
      },
      include: { items: true, cashier: true, voidedBy: true },
    });
  });
}
