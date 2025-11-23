import { prisma } from "../db";

export interface ListProductsOptions {
  categoryId?: string | null;
  search?: string;
  status?: "active" | "inactive";
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export async function listProducts(options: ListProductsOptions = {}) {
  const { categoryId, search, status } = options;

  return prisma.product.findMany({
    where: {
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {}),
    },
    include: {
      variants: true,
      category: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      variants: true,
      category: true,
    },
  });
}

export async function createProduct(input: {
  name: string;
  categoryId: string;
  itemCode: string;
  hasVariants: boolean;
  price?: number;
  stock?: number;
  lowStockThreshold?: number;
  status?: "active" | "inactive";
  image?: string;
}) {
  return prisma.product.create({
    data: {
      name: input.name,
      categoryId: input.categoryId,
      itemCode: input.itemCode,
      hasVariants: input.hasVariants,
      price: input.price,
      stock: input.stock,
      lowStockThreshold: input.lowStockThreshold ?? 0,
      status: input.status ?? "active",
      image: input.image,
    },
  });
}

export async function updateProduct(
  id: string,
  input: Partial<{
    name: string;
    categoryId: string;
    itemCode: string;
    hasVariants: boolean;
    price?: number;
    stock?: number;
    lowStockThreshold: number;
    status: "active" | "inactive";
    image?: string;
  }>,
) {
  return prisma.product.update({
    where: { id },
    data: input,
  });
}

export async function deleteProduct(id: string) {
  await prisma.variant.deleteMany({ where: { productId: id } });
  return prisma.product.delete({ where: { id } });
}


