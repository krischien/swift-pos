import { saasPrisma } from "../db.js";
import { changeFromAmountAndTotal, isAmountInsufficient } from "../../utils/money.js";

export interface CartItemInput {
  productId: string;
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
}

export async function createSale(input: CreateSaleInput) {
  const { storeId, cashierId, cashierName, amountReceived, items } = input;
  const total = input.total;
  const change = changeFromAmountAndTotal(amountReceived, total);

  if (isAmountInsufficient(amountReceived, total)) {
    throw new Error("Amount received is less than total due");
  }

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
      },
    });

    for (const item of items) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        },
      });

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

    return tx.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: true,
        cashier: true,
      },
    });
  });
}

export interface ListSalesOptions {
  from?: Date;
  to?: Date;
  /** active = exclude void (default), voided = void only, all = both */
  voidFilter?: "active" | "voided" | "all";
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
  const { from, to, voidFilter = "active" } = options;

  const statusWhere =
    voidFilter === "voided"
      ? { status: "void" as const }
      : voidFilter === "all"
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
    return tx.sale.update({
      where: { id },
      data: { status: "void" },
      include: { items: true, cashier: true },
    });
  });
}
