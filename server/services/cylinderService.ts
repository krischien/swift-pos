import { prisma } from "../db";

export async function listCylinderLoans(status = "out") {
  return prisma.cylinderLoan.findMany({
    where: {
      storeId: "solo",
      ...(status === "all" ? {} : { status }),
    },
    include: {
      product: { select: { id: true, name: true, cylinderSize: true } },
      customer: true,
      returns: { orderBy: { returnedAt: "asc" } },
      sale: { select: { id: true, ticketNumber: true, createdAt: true, cashierName: true } },
    },
    orderBy: { outAt: "desc" },
  });
}

export async function getCylinderStats() {
  const products = await prisma.product.findMany({ where: { tracksCylinder: true } });
  const loans = await prisma.cylinderLoan.findMany({
    where: { storeId: "solo", status: { in: ["out", "partial"] } },
    include: { returns: true },
  });
  return {
    filledOnHand: products.reduce((sum, p) => sum + (p.stock ?? 0), 0),
    emptyOnHand: products.reduce((sum, p) => sum + p.emptyStock, 0),
    onCustomer: loans.reduce((sum, loan) => sum + loan.quantity - loan.returnedQuantity, 0),
    depositLiability: loans.reduce(
      (sum, loan) => sum + Math.max(0, loan.depositAmount - loan.returns.reduce((r, event) => r + event.refundAmount, 0)),
      0,
    ),
    lowFilledCount: products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= p.lowStockThreshold).length,
    outOfFilledCount: products.filter((p) => (p.stock ?? 0) <= 0).length,
    lowEmptyCount: products.filter((p) => p.emptyStock > 0 && p.emptyStock <= p.lowStockThreshold).length,
    outOfEmptyCount: products.filter((p) => p.emptyStock <= 0).length,
  };
}

export async function returnCylinderLoan(
  id: string,
  options: { quantity: number; refundAmount?: number; note?: string; actorId?: string; actorName?: string },
) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.cylinderLoan.findFirst({
      where: { id, storeId: "solo", status: { in: ["out", "partial"] } },
      include: { returns: true },
    });
    if (!loan) throw new Error("Outstanding canister record not found");
    const quantity = Math.floor(options.quantity);
    const remaining = loan.quantity - loan.returnedQuantity;
    if (quantity < 1 || quantity > remaining) throw new Error(`Return quantity must be between 1 and ${remaining}`);
    const refunded = loan.returns.reduce((sum, event) => sum + event.refundAmount, 0);
    const refundable = Math.max(0, loan.depositAmount - refunded);
    const refundAmount = Math.max(0, options.refundAmount ?? loan.depositAmount * quantity / loan.quantity);
    if (refundAmount > refundable + 0.005) throw new Error("Refund exceeds refundable deposit");
    const returnedQuantity = loan.returnedQuantity + quantity;
    const complete = returnedQuantity === loan.quantity;
    await tx.cylinderLoan.update({
      where: { id },
      data: {
        returnedQuantity,
        status: complete ? "returned" : "partial",
        returnedAt: complete ? new Date() : null,
        depositRefunded: complete && refunded + refundAmount + 0.005 >= loan.depositAmount,
      },
    });
    await tx.cylinderReturn.create({
      data: {
        loanId: id,
        storeId: "solo",
        quantity,
        refundAmount,
        actorId: options.actorId || null,
        actorName: options.actorName?.trim() || null,
        note: options.note?.trim() || null,
      },
    });
    await tx.product.update({ where: { id: loan.productId }, data: { emptyStock: { increment: quantity } } });
    return tx.cylinderLoan.findUnique({
      where: { id },
      include: { product: true, customer: true, returns: true, sale: true },
    });
  });
}
