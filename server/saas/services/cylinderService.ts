import { saasPrisma } from "../db.js";

type Tx = Parameters<Parameters<typeof saasPrisma.$transaction>[0]>[0];

export interface CylinderLineInput {
  productId: string;
  quantity: number;
  saleItemId?: string;
  /** Customer brought empty — exchange at sale; no outstanding loan */
  broughtEmpty?: boolean;
}

export interface CylinderSaleContext {
  storeId: string;
  saleId: string;
  customerName?: string;
  customerPhone?: string;
  collectDeposits?: boolean;
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

    if (line.broughtEmpty) {
      await tx.product.update({
        where: { id: product.id },
        data: { emptyStock: { increment: qty } },
      });
      continue;
    }

    const unitDeposit =
      ctx.collectDeposits && (product.depositAmount ?? 0) > 0 ? product.depositAmount! : 0;

    await tx.cylinderLoan.create({
      data: {
        storeId: ctx.storeId,
        saleId: ctx.saleId,
        saleItemId: line.saleItemId ?? null,
        productId: product.id,
        quantity: qty,
        customerName: ctx.customerName?.trim() || null,
        customerPhone: ctx.customerPhone?.trim() || null,
        depositAmount: unitDeposit * qty,
        status: "out",
      },
    });
  }
}

export async function voidCylinderLoansForSale(tx: Tx, saleId: string) {
  const openLoans = await tx.cylinderLoan.findMany({
    where: { saleId, status: "out" },
  });
  if (!openLoans.length) return;

  await tx.cylinderLoan.updateMany({
    where: { saleId, status: "out" },
    data: { status: "written_off", returnedAt: new Date() },
  });
}

export async function returnCylinderLoan(
  storeId: string,
  loanId: string,
  options?: { refundDeposit?: boolean },
) {
  return saasPrisma.$transaction(async (tx) => {
    const loan = await tx.cylinderLoan.findFirst({
      where: { id: loanId, storeId, status: "out" },
      include: { product: true },
    });
    if (!loan) throw new Error("Outstanding canister record not found");

    await tx.cylinderLoan.update({
      where: { id: loanId },
      data: {
        status: "returned",
        returnedAt: new Date(),
        depositRefunded: Boolean(options?.refundDeposit && loan.depositAmount > 0),
      },
    });

    await tx.product.update({
      where: { id: loan.productId },
      data: { emptyStock: { increment: loan.quantity } },
    });

    return tx.cylinderLoan.findUnique({
      where: { id: loanId },
      include: { product: true, sale: { select: { ticketNumber: true, createdAt: true } } },
    });
  });
}

export async function listCylinderLoans(
  storeId: string,
  status: "out" | "returned" | "written_off" | "all" = "out",
) {
  return saasPrisma.cylinderLoan.findMany({
    where: {
      storeId,
      ...(status === "all" ? {} : { status }),
    },
    include: {
      product: { select: { id: true, name: true, cylinderSize: true } },
      sale: { select: { id: true, ticketNumber: true, createdAt: true, cashierName: true } },
    },
    orderBy: { outAt: "desc" },
    take: 200,
  });
}

export async function getCylinderStats(storeId: string) {
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
    where: { storeId, status: "out" },
    select: { quantity: true, depositAmount: true, depositRefunded: true },
  });

  const onCustomer = openLoans.reduce((sum, l) => sum + l.quantity, 0);
  const depositLiability = openLoans.reduce(
    (sum, l) => sum + (l.depositRefunded ? 0 : l.depositAmount),
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
