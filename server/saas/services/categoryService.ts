import { saasPrisma } from "../db.js";

export async function listCategories(storeId: string) {
  return saasPrisma.category.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(storeId: string, name: string) {
  return saasPrisma.category.create({
    data: { storeId, name },
  });
}

export async function updateCategory(id: string, storeId: string, name: string) {
  const existing = await saasPrisma.category.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Category not found");
  return saasPrisma.category.update({
    where: { id },
    data: { name },
  });
}

export async function deleteCategory(id: string, storeId: string) {
  const existing = await saasPrisma.category.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Category not found");
  return saasPrisma.category.delete({
    where: { id },
  });
}
