import { prisma } from "../db";
import type { CartItem } from "../types";
import { changePhpFromCents, paymentCoversTotal, phpToCents } from "../utils/money.js";

export interface CreateSaleInput {
  cartItems: CartItem[];
  cashierId: string;
  cashierName: string;
  paymentMethod?: "cash";
  amountReceived: number;
  taxRate?: number; // e.g. 0.1 for 10%
  ticketNumber?: string;
  discountPercent?: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  cylinderTrackingEnabled?: boolean;
  collectDeposits?: boolean;
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
  const trackedProducts = input.cylinderTrackingEnabled
    ? await prisma.product.findMany({
        where: { id: { in: cartItems.map((item) => item.productId) }, tracksCylinder: true },
      })
    : [];
  const trackedById = new Map(trackedProducts.map((product) => [product.id, product]));
  const outstandingQuantity = cartItems.reduce((sum, item) => {
    if (!trackedById.has(item.productId)) return sum;
    const exchanged = Math.min(item.quantity, Math.max(0, Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0))));
    return sum + Math.max(0, item.quantity - exchanged);
  }, 0);
  if (outstandingQuantity > 0 && !input.customerId) {
    throw new Error("Customer is required when a canister remains with the customer");
  }
  const depositAmount = input.collectDeposits
    ? cartItems.reduce((sum, item) => {
        const product = trackedById.get(item.productId);
        if (!product) return sum;
        const exchanged = Math.min(item.quantity, Math.max(0, Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0))));
        return sum + Math.max(0, item.quantity - exchanged) * product.depositAmount;
      }, 0)
    : 0;
  const total = netSubtotal + tax;
  const amountDue = total + depositAmount;
  const receivedCents = phpToCents(amountReceived);
  const totalCents = phpToCents(amountDue);
  if (!paymentCoversTotal(amountReceived, amountDue)) {
    throw new Error("Amount received is less than total due");
  }
  const change = changePhpFromCents(receivedCents, totalCents);

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
        depositAmount,
        amountDue,
        customerId: input.customerId ?? null,
        paymentMethod: "cash",
        amountReceived,
        change,
      },
    });

    for (const item of cartItems) {
      const broughtEmptyQuantity = Math.min(
        item.quantity,
        Math.max(0, Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0))),
      );
      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.name,
          variantName: item.variantName,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          broughtEmptyQuantity,
        },
      });

      const tracked = trackedById.get(item.productId);
      if (tracked && broughtEmptyQuantity > 0) {
        await tx.product.update({
          where: { id: item.productId },
          data: { emptyStock: { increment: broughtEmptyQuantity } },
        });
      }
      const loanQuantity = tracked ? Math.max(0, item.quantity - broughtEmptyQuantity) : 0;
      if (tracked && loanQuantity > 0) {
        await tx.cylinderLoan.create({
          data: {
            storeId: "solo",
            saleId: sale.id,
            saleItemId: saleItem.id,
            productId: item.productId,
            customerId: input.customerId,
            customerName: input.customerName?.trim() || null,
            customerPhone: input.customerPhone?.trim() || null,
            quantity: loanQuantity,
            depositAmount: input.collectDeposits ? tracked.depositAmount * loanQuantity : 0,
          },
        });
      }

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
        customer: true,
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


