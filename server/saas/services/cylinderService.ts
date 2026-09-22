import { saasPrisma } from "../db.js";
import { requireCylinderTracking } from "./customerService.js";

type Tx = Parameters<Parameters<typeof saasPrisma.$transaction>[0]>[0];

export interface CylinderLineInput {
  loanId?: string;
  productId: string;
  quantity: number;
  saleItemId?: string;
  /** Customer brought empty — exchange at sale; no outstanding loan */
  broughtEmptyQuantity?: number;
}

export interface CylinderSaleContext {
  storeId: string;
  saleId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  collectDeposits: boolean;
  lines: CylinderLineInput[];
}

export async function processCylinderLinesOnSale(tx: Tx, ctx: CylinderSaleContext) {
  for (const line of ctx.lines) {
    const product = await tx.product.findFirst({
      where: { id: line.productId, storeId: ctx.storeId },
    });
    if (!product?.tracksCylinder) continue;

    const qty = Math.max(0, Math.floor(line.quantity));
    if (qty <= 0) continue;

    const broughtEmptyQuantity = Math.min(
      qty,
      Math.max(0, Math.floor(line.broughtEmptyQuantity ?? 0)),
    );
    if (broughtEmptyQuantity > 0) {
      await tx.product.update({
        where: { id: product.id },
        data: { emptyStock: { increment: broughtEmptyQuantity } },
      });
    }
    const loanQuantity = qty - broughtEmptyQuantity;
    if (loanQuantity <= 0) continue;

    const unitDeposit =
      ctx.collectDeposits && (product.depositAmount ?? 0) > 0 ? product.depositAmount! : 0;

    await tx.cylinderLoan.create({
      data: {
        ...(line.loanId ? { id: line.loanId } : {}),
        storeId: ctx.storeId,
        saleId: ctx.saleId,
        saleItemId: line.saleItemId ?? null,
        productId: product.id,
        quantity: loanQuantity,
        customerId: ctx.customerId ?? null,
        customerName: ctx.customerName?.trim() || null,
        customerPhone: ctx.customerPhone?.trim() || null,
        depositAmount: unitDeposit * loanQuantity,
        status: "out",
      },
    });
  }
}

export async function voidCylinderLoansForSale(tx: Tx, saleId: string) {
  const openLoans = await tx.cylinderLoan.findMany({
    where: { saleId, status: { in: ["out", "partial"] } },
  });
  if (!openLoans.length) return;

  await tx.cylinderLoan.updateMany({
    where: { saleId, status: { in: ["out", "partial"] } },
    data: { status: "written_off", returnedAt: new Date() },
  });
}

export async function returnCylinderLoan(
  storeId: string,
  loanId: string,
  options: {
    quantity: number;
    refundAmount?: number;
    actorId?: string;
    actorName?: string;
    note?: string;
    eventId?: string;
  },
) {
  const settings = await requireCylinderTracking(storeId);
  return saasPrisma.$transaction(async (tx) => {
    if (options.eventId) {
      const prior = await tx.cylinderReturn.findUnique({ where: { id: options.eventId } });
      if (prior) {
        if (prior.storeId !== storeId || prior.loanId !== loanId) {
          throw new Error("Return event id is already in use");
        }
        return tx.cylinderLoan.findUnique({
          where: { id: loanId },
          include: { product: true, customer: true, returns: true, sale: true },
        });
      }
    }
    const loan = await tx.cylinderLoan.findFirst({
      where: { id: loanId, storeId, status: { in: ["out", "partial"] } },
      include: { product: true, returns: true },
    });
    if (!loan) throw new Error("Outstanding canister record not found");
    const quantity = Math.floor(options.quantity);
    const remaining = loan.quantity - loan.returnedQuantity;
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > remaining) {
      throw new Error(`Return quantity must be between 1 and ${remaining}`);
    }
    const refundedSoFar = loan.returns.reduce((sum, event) => sum + event.refundAmount, 0);
    const refundableRemaining = settings.collectCylinderDeposits
      ? Math.max(0, loan.depositAmount - refundedSoFar)
      : 0;
    const proportionalRefund = settings.collectCylinderDeposits
      ? (loan.depositAmount * quantity) / loan.quantity
      : 0;
    const refundAmount = Math.max(0, options.refundAmount ?? proportionalRefund);
    if (refundAmount > refundableRemaining + 0.005) {
      throw new Error("Refund exceeds refundable deposit");
    }
    const returnedQuantity = loan.returnedQuantity + quantity;
    const returned = returnedQuantity === loan.quantity;

    await tx.cylinderLoan.update({
      where: { id: loanId },
      data: {
        ...(options.eventId ? { id: options.eventId } : {}),
        returnedQuantity,
        status: returned ? "returned" : "partial",
        returnedAt: returned ? new Date() : null,
        depositRefunded:
          returned &&
          refundedSoFar + refundAmount +
            0.005 >=
            loan.depositAmount,
      },
    });
    await tx.cylinderReturn.create({
      data: {
        loanId,
        storeId,
        quantity,
        refundAmount,
        actorId: options.actorId ?? null,
        actorName: options.actorName?.trim() || null,
        note: options.note?.trim() || null,
      },
    });

    await tx.product.update({
      where: { id: loan.productId },
      data: { emptyStock: { increment: quantity } },
    });

    return tx.cylinderLoan.findUnique({
      where: { id: loanId },
      include: {
        product: true,
        customer: true,
        returns: { orderBy: { returnedAt: "asc" } },
        sale: { select: { ticketNumber: true, createdAt: true } },
      },
    });
  });
}

export async function listCylinderLoans(
  storeId: string,
  status: "out" | "partial" | "returned" | "written_off" | "all" = "out",
) {
  await requireCylinderTracking(storeId);
  return saasPrisma.cylinderLoan.findMany({
    where: {
      storeId,
      ...(status === "all" ? {} : { status }),
    },
    include: {
      product: { select: { id: true, name: true, cylinderSize: true } },
      customer: true,
      returns: { orderBy: { returnedAt: "asc" } },
      sale: { select: { id: true, ticketNumber: true, createdAt: true, cashierName: true } },
    },
    orderBy: { outAt: "desc" },
    take: 200,
  });
}

export async function getCylinderStats(storeId: string) {
  await requireCylinderTracking(storeId);
  const tracked = await saasPrisma.product.findMany({
    where: { storeId, tracksCylinder: true },
    select: { stock: true, emptyStock: true, lowStockThreshold: true },
  });

  const filledOnHand = tracked.reduce((sum, p) => sum + (p.stock ?? 0), 0);
  const emptyOnHand = tracked.reduce((sum, p) => sum + (p.emptyStock ?? 0), 0);

  let lowFilledCount = 0;
  let outOfFilledCount = 0;
  let lowEmptyCount = 0;
  let outOfEmptyCount = 0;
  for (const p of tracked) {
    const filled = p.stock ?? 0;
    const empty = p.emptyStock ?? 0;
    const threshold = p.lowStockThreshold ?? 0;
    if (filled <= 0) outOfFilledCount += 1;
    else if (filled <= threshold) lowFilledCount += 1;
    if (empty <= 0) outOfEmptyCount += 1;
    else if (empty <= threshold) lowEmptyCount += 1;
  }

  const openLoans = await saasPrisma.cylinderLoan.findMany({
    where: { storeId, status: { in: ["out", "partial"] } },
    select: { quantity: true, returnedQuantity: true, depositAmount: true, returns: true },
  });

  const onCustomer = openLoans.reduce((sum, l) => sum + l.quantity - l.returnedQuantity, 0);
  const depositLiability = openLoans.reduce(
    (sum, l) => sum + Math.max(0, l.depositAmount - l.returns.reduce((r, e) => r + e.refundAmount, 0)),
    0,
  );

  return {
    filledOnHand,
    onCustomer,
    emptyOnHand,
    depositLiability,
    lowFilledCount,
    outOfFilledCount,
    lowEmptyCount,
    outOfEmptyCount,
  };
}
