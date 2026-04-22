import { saasPrisma } from "../db.js";
import { changePhpFromCents, paymentCoversTotal, phpToCents } from "../../utils/money.js";

export interface CartItemInput {
  productId?: string;
  menuItemId?: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
  subtotal: number;
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
  const receivedCents = phpToCents(amountReceived);
  const totalCents = phpToCents(total);
  if (!paymentCoversTotal(amountReceived, total)) {
    throw new Error("Amount received is less than total due");
  }
  const change = changePhpFromCents(receivedCents, totalCents);

  await validateCartForStoreMode(storeId, items);

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
        paymentMethod: input.paymentMethod ?? "cash",
        amountReceived,
        change,
        gcashTransactionId: input.gcashTransactionId ?? null,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
    });

    for (const item of items) {
      await tx.saleItem.create({
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
        },
      });

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

    return tx.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: true,
        cashier: true,
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
    },
  });
}

export async function voidSale(id: string, storeId: string) {
  const sale = await saasPrisma.sale.findFirst({
    where: { id, storeId },
    include: { items: true },
  });
  if (!sale) return null;
  if ((sale as { status?: string }).status === "void") {
    throw new Error("Sale is already voided");
  }

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
    return tx.sale.update({
      where: { id },
      data: { status: "void" },
      include: { items: true, cashier: true },
    });
  });
}
