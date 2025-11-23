import { prisma } from "./db";
import { mockCategories, mockProducts, mockUser } from "../src/lib/mockData";

async function main() {
  console.log("Seeding database with mock data...");

  // Clear existing data in order of relations
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Admin user (john@example.com)
  const adminUser = await prisma.user.create({
    data: {
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
      role: "admin",
    },
  });

  // Cashier user
  const cashierUser = await prisma.user.create({
    data: {
      name: "Cashier User",
      email: "cashier@example.com",
      role: "cashier",
    },
  });

  // Categories
  for (const category of mockCategories) {
    await prisma.category.create({
      data: {
        id: category.id,
        name: category.name,
      },
    });
  }

  // Products & variants
  for (const product of mockProducts) {
    await prisma.product.create({
      data: {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        itemCode: product.itemCode,
        hasVariants: product.hasVariants,
        price: product.price,
        stock: product.stock ?? undefined,
        lowStockThreshold: product.lowStockThreshold,
        status: product.status,
        image: product.image,
        variants: product.variants
          ? {
              create: product.variants.map((v) => ({
                id: v.id,
                name: v.name,
                price: v.price,
                stock: v.stock,
              })),
            }
          : undefined,
      },
    });
  }

  console.log("Seeding complete.");
  console.log("Admin user:", adminUser.email);
  console.log("Cashier user:", cashierUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

