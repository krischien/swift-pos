import { prisma } from "../db";
import type { CartItem } from "../types";
import { changeFromAmountAndTotal, isAmountInsufficient } from "../utils/money.js";

export interface CreateSaleInput {
  cartItems: CartItem[];
  cashierId: string;
  cashierName: string;
  paymentMethod?: "cash";
  amountReceived: number;
  taxRate?: number; // e.g. 0.1 for 10%
  ticketNumber?: string;
  discountPercent?: number;
}

export async function createSale(input: CreateSaleInput) {
  const { cartItems, cashierId, cashierName, amountReceived } = input;
  const taxRate = input.taxRate ?? 0.1;
  const discountPercent = input.discountPercent ?? 0;

  const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const clampedDiscount = Math.max(0, Math.min(100, discountPercent));
  const discountAmount = subtotal * (clampedDiscount / 100);
  const netSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = netSubtotal * taxRate;
  const total = netSubtotal + tax;
  const change = changeFromAmountAndTotal(amountReceived, total);

  if (isAmountInsufficient(amountReceived, total)) {
    throw new Error("Amount received is less than total due");
  }

  return prisma.$transaction(async (tx) => {
    const ticketNumber =
      input.ticketNumber ||
      `T-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        Math.random() * 999,
      )
        .toString()
        .padStart(3, "0")}`;

    const sale = await tx.sale.create({
      data: {
        ticketNumber,
        cashierId,
        cashierName,
        total,
        paymentMethod: "cash",
        amountReceived,
        change,
      },
    });

    for (const item of cartItems) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.name,
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
}

export async function listSales(options: ListSalesOptions = {}) {
  const { from, to } = options;

  return prisma.sale.findMany({
    where: {
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

export async function getSaleById(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: {
      items: true,
      cashier: true,
    },
  });
}


