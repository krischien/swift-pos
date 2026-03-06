import { saasPrisma } from "../db.js";

export async function listVariantsByProduct(productId: string, storeId: string) {
  const product = await saasPrisma.product.findFirst({
    where: { id: productId, storeId },
  });
  if (!product) throw new Error("Product not found");

  return saasPrisma.variant.findMany({
    where: { productId },
    orderBy: { name: "asc" },
  });
}

export async function createVariant(
  productId: string,
  storeId: string,
  input: { name: string; price: number; stock: number }
) {
  const product = await saasPrisma.product.findFirst({
    where: { id: productId, storeId },
  });
  if (!product) throw new Error("Product not found");

  return saasPrisma.$transaction(async (tx) => {
    const variant = await tx.variant.create({
      data: {
        productId,
        name: input.name,
        price: input.price,
        stock: input.stock,
      },
    });

    await tx.product.update({
      where: { id: productId },
      data: { hasVariants: true },
    });

    return variant;
  });
}

export async function updateVariant(
  id: string,
  storeId: string,
  input: Partial<{ name: string; price: number; stock: number }>
) {
  const variant = await saasPrisma.variant.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!variant || variant.product.storeId !== storeId) {
    throw new Error("Variant not found");
  }

  return saasPrisma.variant.update({
    where: { id },
    data: input,
  });
}

export async function deleteVariant(id: string, storeId: string) {
  const variant = await saasPrisma.variant.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!variant || variant.product.storeId !== storeId) {
    throw new Error("Variant not found");
  }

  return saasPrisma.$transaction(async (tx) => {
    await tx.variant.delete({ where: { id } });

    const remaining = await tx.variant.count({
      where: { productId: variant.productId },
    });

    if (remaining === 0) {
      await tx.product.update({
        where: { id: variant.productId },
        data: { hasVariants: false },
      });
    }
  });
}
