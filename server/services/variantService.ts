import { prisma } from "../db";

export async function listVariantsByProduct(productId: string) {
  return prisma.variant.findMany({
    where: { productId },
    orderBy: { name: "asc" },
  });
}

export async function createVariant(
  productId: string,
  input: { name: string; price: number; stock: number },
) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.variant.create({
      data: {
        productId,
        name: input.name,
        price: input.price,
        stock: input.stock,
      },
    });

    // Ensure product is marked as having variants
    await tx.product.update({
      where: { id: productId },
      data: { hasVariants: true },
    });

    return variant;
  });
}

export async function updateVariant(
  id: string,
  input: Partial<{ name: string; price: number; stock: number }>,
) {
  return prisma.variant.update({
    where: { id },
    data: input,
  });
}

export async function deleteVariant(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.variant.findUnique({
      where: { id },
      select: { productId: true },
    });

    if (!existing) return;

    await tx.variant.delete({ where: { id } });

    const remaining = await tx.variant.count({
      where: { productId: existing.productId },
    });

    if (remaining === 0) {
      await tx.product.update({
        where: { id: existing.productId },
        data: { hasVariants: false },
      });
    }
  });
}


