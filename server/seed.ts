import { prisma } from "./db";
import { mockCategories, mockProducts, mockUser } from "../src/lib/mockData";

const DEFAULT_PASSWORD = "password123";
const DEFAULT_PASSWORD_HASH = "$2b$10$VwNM8YMo1sKEtKKbZ2tgMOtLdbBL2hjD9VtH003WfLW7C2iU0NICq";

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
      password: DEFAULT_PASSWORD_HASH,
      role: "admin",
    },
  });

  // Cashier user
  const cashierUser = await prisma.user.create({
    data: {
      name: "Cashier User",
      email: "cashier@example.com",
      password: DEFAULT_PASSWORD_HASH,
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

  // Create sample sales for the current month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Helper to create a date in the current month
  const createDateInCurrentMonth = (day: number, hour: number = 12, minute: number = 0) => {
    return new Date(currentYear, currentMonth, day, hour, minute, 0);
  };

  // Sample sales with various products and quantities
  const sampleSales = [
    {
      ticketNumber: "T-SEED-001",
      cashierId: adminUser.id,
      cashierName: adminUser.name,
      createdAt: createDateInCurrentMonth(1, 10, 30),
      items: [
        { productId: "2", variantId: null, productName: "Orange Juice", variantName: null, quantity: 5, price: 2.5 },
        { productId: "4", variantId: null, productName: "Chocolate Bar", variantName: null, quantity: 3, price: 1.8 },
        { productId: "1", variantId: "v1", productName: "Cola", variantName: "Small (330ml)", quantity: 2, price: 1.5 },
      ],
    },
    {
      ticketNumber: "T-SEED-002",
      cashierId: cashierUser.id,
      cashierName: cashierUser.name,
      createdAt: createDateInCurrentMonth(2, 14, 15),
      items: [
        { productId: "5", variantId: "v7", productName: "Burger Combo", variantName: "Classic Burger", quantity: 2, price: 5.5 },
        { productId: "1", variantId: "v2", productName: "Cola", variantName: "Medium (500ml)", quantity: 2, price: 2.0 },
        { productId: "6", variantId: null, productName: "Pizza Slice", variantName: null, quantity: 1, price: 3.5 },
      ],
    },
    {
      ticketNumber: "T-SEED-003",
      cashierId: adminUser.id,
      cashierName: adminUser.name,
      createdAt: createDateInCurrentMonth(3, 11, 0),
      items: [
        { productId: "9", variantId: "v13", productName: "Coffee", variantName: "Espresso", quantity: 4, price: 2.0 },
        { productId: "9", variantId: "v14", productName: "Coffee", variantName: "Cappuccino", quantity: 3, price: 3.0 },
        { productId: "8", variantId: null, productName: "Brownie", variantName: null, quantity: 2, price: 2.0 },
      ],
    },
    {
      ticketNumber: "T-SEED-004",
      cashierId: cashierUser.id,
      cashierName: cashierUser.name,
      createdAt: createDateInCurrentMonth(5, 16, 45),
      items: [
        { productId: "3", variantId: "v4", productName: "Potato Chips", variantName: "Regular", quantity: 5, price: 1.2 },
        { productId: "3", variantId: "v5", productName: "Potato Chips", variantName: "BBQ", quantity: 3, price: 1.2 },
        { productId: "7", variantId: "v10", productName: "Ice Cream", variantName: "Vanilla", quantity: 2, price: 2.5 },
        { productId: "10", variantId: null, productName: "Hot Chocolate", variantName: null, quantity: 1, price: 2.8 },
      ],
    },
    {
      ticketNumber: "T-SEED-005",
      cashierId: adminUser.id,
      cashierName: adminUser.name,
      createdAt: createDateInCurrentMonth(7, 9, 30),
      items: [
        { productId: "1", variantId: "v1", productName: "Cola", variantName: "Small (330ml)", quantity: 8, price: 1.5 },
        { productId: "1", variantId: "v3", productName: "Cola", variantName: "Large (1L)", quantity: 4, price: 3.0 },
        { productId: "2", variantId: null, productName: "Orange Juice", variantName: null, quantity: 6, price: 2.5 },
      ],
    },
    {
      ticketNumber: "T-SEED-006",
      cashierId: cashierUser.id,
      cashierName: cashierUser.name,
      createdAt: createDateInCurrentMonth(10, 13, 20),
      items: [
        { productId: "5", variantId: "v8", productName: "Burger Combo", variantName: "Cheese Burger", quantity: 3, price: 6.0 },
        { productId: "5", variantId: "v9", productName: "Burger Combo", variantName: "Double Burger", quantity: 2, price: 7.5 },
        { productId: "6", variantId: null, productName: "Pizza Slice", variantName: null, quantity: 4, price: 3.5 },
      ],
    },
    {
      ticketNumber: "T-SEED-007",
      cashierId: adminUser.id,
      cashierName: adminUser.name,
      createdAt: createDateInCurrentMonth(12, 15, 0),
      items: [
        { productId: "9", variantId: "v15", productName: "Coffee", variantName: "Latte", quantity: 5, price: 3.5 },
        { productId: "9", variantId: "v14", productName: "Coffee", variantName: "Cappuccino", quantity: 3, price: 3.0 },
        { productId: "7", variantId: "v11", productName: "Ice Cream", variantName: "Chocolate", quantity: 2, price: 2.5 },
      ],
    },
    {
      ticketNumber: "T-SEED-008",
      cashierId: cashierUser.id,
      cashierName: cashierUser.name,
      createdAt: createDateInCurrentMonth(15, 11, 45),
      items: [
        { productId: "4", variantId: null, productName: "Chocolate Bar", variantName: null, quantity: 10, price: 1.8 },
        { productId: "3", variantId: "v6", productName: "Potato Chips", variantName: "Sour Cream", quantity: 4, price: 1.2 },
        { productId: "8", variantId: null, productName: "Brownie", variantName: null, quantity: 3, price: 2.0 },
      ],
    },
    {
      ticketNumber: "T-SEED-009",
      cashierId: adminUser.id,
      cashierName: adminUser.name,
      createdAt: createDateInCurrentMonth(18, 10, 15),
      items: [
        { productId: "1", variantId: "v2", productName: "Cola", variantName: "Medium (500ml)", quantity: 6, price: 2.0 },
        { productId: "2", variantId: null, productName: "Orange Juice", variantName: null, quantity: 4, price: 2.5 },
        { productId: "10", variantId: null, productName: "Hot Chocolate", variantName: null, quantity: 2, price: 2.8 },
      ],
    },
    {
      ticketNumber: "T-SEED-010",
      cashierId: cashierUser.id,
      cashierName: cashierUser.name,
      createdAt: createDateInCurrentMonth(20, 14, 30),
      items: [
        { productId: "7", variantId: "v12", productName: "Ice Cream", variantName: "Strawberry", quantity: 3, price: 2.5 },
        { productId: "7", variantId: "v10", productName: "Ice Cream", variantName: "Vanilla", quantity: 2, price: 2.5 },
        { productId: "9", variantId: "v13", productName: "Coffee", variantName: "Espresso", quantity: 3, price: 2.0 },
      ],
    },
  ];

  // Create sales with items
  for (const saleData of sampleSales) {
    // Calculate totals
    const subtotal = saleData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = 0.1;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const amountReceived = Math.ceil(total / 10) * 10; // Round up to nearest 10
    const change = amountReceived - total;

    const sale = await prisma.sale.create({
      data: {
        ticketNumber: saleData.ticketNumber,
        cashierId: saleData.cashierId,
        cashierName: saleData.cashierName,
        total,
        paymentMethod: "cash",
        amountReceived,
        change,
        createdAt: saleData.createdAt,
        items: {
          create: saleData.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity,
          })),
        },
      },
    });

    // Update stock for products and variants
    for (const item of saleData.items) {
      if (item.variantId) {
        await prisma.variant.update({
          where: { id: item.variantId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      } else {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }
    }
  }

  console.log("Seeding complete.");
  console.log("Admin user:", adminUser.email);
  console.log("Cashier user:", cashierUser.email);
  console.log("Default password:", DEFAULT_PASSWORD);
  console.log(`Created ${sampleSales.length} sample sales for the current month.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

