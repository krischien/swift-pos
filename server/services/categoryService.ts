import { prisma } from "../db";

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createCategory(name: string) {
  return prisma.category.create({
    data: { name },
  });
}

export async function updateCategory(id: string, name: string) {
  return prisma.category.update({
    where: { id },
    data: { name },
  });
}

export async function deleteCategory(id: string) {
  return prisma.category.delete({
    where: { id },
  });
}


