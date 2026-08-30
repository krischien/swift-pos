/**
 * Themed demo catalogs for SaaS seed — 3 stores with realistic inventory mix.
 */

export interface DemoVariantSeed {
  name: string;
  price: number;
  stock: number;
}

export interface DemoProductSeed {
  name: string;
  category: string;
  itemCode: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  marginPercentage: number;
  /** 1–10 — higher = sold more often in generated transactions */
  popularity: number;
  hasVariants?: boolean;
  variants?: DemoVariantSeed[];
}

export interface DemoStoreConfig {
  name: string;
  address: string;
  cashier: { name: string; email: string };
  /** Sales per day range over the seed period */
  dailySalesMin: number;
  dailySalesMax: number;
  openHour: number;
  closeHour: number;
  /** Hours with heavier foot traffic */
  peakHours: number[];
  products: DemoProductSeed[];
}

const p = (
  name: string,
  category: string,
  itemCode: string,
  price: number,
  stock: number,
  lowStockThreshold: number,
  popularity: number,
  marginPercentage = 25,
): DemoProductSeed => ({
  name,
  category,
  itemCode,
  price,
  stock,
  lowStockThreshold,
  marginPercentage,
  popularity,
});

export const DEMO_STORES: DemoStoreConfig[] = [
  {
    name: "Sari-Sari Corner",
    address: "Purok 3, Barangay Maligaya, Quezon",
    cashier: { name: "Maria Santos", email: "maria@demo.com" },
    dailySalesMin: 14,
    dailySalesMax: 24,
    openHour: 6,
    closeHour: 21,
    peakHours: [7, 8, 12, 17, 18, 19],
    products: [
      // Snacks & Chips — healthy movers
      p("Chippy Barbecue 110g", "Snacks & Chips", "CV-001", 20, 86, 15, 9, 22),
      p("Nova Country Cheddar 78g", "Snacks & Chips", "CV-002", 15, 72, 15, 8, 20),
      p("Piattos Cheese 85g", "Snacks & Chips", "CV-003", 25, 64, 12, 7, 24),
      p("Oishi Prawn Crackers 60g", "Snacks & Chips", "CV-004", 12, 58, 12, 8, 18),
      p("Boy Bawang Garlic 100g", "Snacks & Chips", "CV-005", 10, 0, 10, 6, 20), // out of stock
      // Drinks
      p("Coke Mismo 300ml", "Drinks", "CV-010", 20, 120, 24, 10, 18),
      p("Royal Tru-Orange Mismo", "Drinks", "CV-011", 20, 95, 24, 9, 18),
      p("C2 Green Tea Apple 230ml", "Drinks", "CV-012", 15, 78, 20, 8, 22),
      p("Bear Brand Swak 33g", "Drinks", "CV-013", 12, 0, 12, 7, 15), // out of stock
      p("Wilkins Distilled 500ml", "Drinks", "CV-014", 18, 45, 15, 7, 16),
      p("Gatorade Blue Bolt 500ml", "Drinks", "CV-015", 45, 3, 10, 5, 28), // low stock
      // Instant noodles
      p("Lucky Me Pancit Canton Original", "Instant Noodles", "CV-020", 15, 144, 30, 10, 20),
      p("Lucky Me Beef Instant Mami", "Instant Noodles", "CV-021", 12, 98, 25, 9, 18),
      p("Lucky Me Chicken Sotanghon", "Instant Noodles", "CV-022", 12, 76, 20, 8, 18),
      p("Payless Xtra Big Kalabasa", "Instant Noodles", "CV-023", 18, 4, 12, 6, 22), // low stock
      // Canned goods
      p("Argentina Corned Beef 175g", "Canned Goods", "CV-030", 55, 36, 10, 7, 25),
      p("555 Sardines in Tomato 155g", "Canned Goods", "CV-031", 22, 52, 12, 8, 20),
      p("Century Tuna Flakes in Oil 155g", "Canned Goods", "CV-032", 38, 41, 10, 9, 24),
      p("Young's Town Mackerel 155g", "Canned Goods", "CV-033", 28, 2, 8, 5, 22), // low stock
      // Personal care
      p("Safeguard White 135g", "Personal Care", "CV-040", 45, 28, 10, 6, 30),
      p("Colgate Max Fresh 150g", "Personal Care", "CV-041", 85, 22, 8, 6, 32),
      p("Sunsilk Pink 180ml", "Personal Care", "CV-042", 55, 3, 10, 4, 28), // low stock
      p("Palmolive Naturals 90g", "Personal Care", "CV-043", 35, 18, 8, 5, 26),
      // Household
      p("Surf Powder Rose Fresh 65g", "Household", "CV-050", 8, 64, 15, 7, 18),
      p("Zonrox Bleach Original 250ml", "Household", "CV-051", 28, 38, 10, 6, 22),
      p("Joy Dishwashing Lemon 390ml", "Household", "CV-052", 55, 5, 10, 5, 24), // low stock
      p("Champion Supra Bar 400g", "Household", "CV-053", 32, 0, 8, 4, 20), // out of stock
      // Cooking needs
      p("Mama Sita Pancit Canton Mix", "Cooking Needs", "CV-060", 18, 42, 10, 6, 22),
      p("Ajinomoto Crispy Fry 62g", "Cooking Needs", "CV-061", 12, 55, 12, 7, 18),
      p("Silver Swan Soy Sauce 385ml", "Cooking Needs", "CV-062", 32, 30, 8, 6, 20),
      p("Knorr Chicken Cube 8g", "Cooking Needs", "CV-063", 6, 88, 20, 8, 15),
      // Candy
      p("Halls Menthol 25pcs", "Candy & Sweets", "CV-070", 45, 24, 8, 5, 30),
      p("Choc Nut 24pcs", "Candy & Sweets", "CV-071", 55, 19, 8, 6, 28),
      p("Maxx Honey Mango", "Candy & Sweets", "CV-072", 2, 110, 20, 7, 12),
    ],
  },
  {
    name: "PawMart Pet Shoppe",
    address: "Unit 4, Pet Lovers Arcade, Makati Ave",
    cashier: { name: "Juan Dela Cruz", email: "juan@demo.com" },
    dailySalesMin: 5,
    dailySalesMax: 12,
    openHour: 9,
    closeHour: 19,
    peakHours: [10, 11, 14, 15, 16],
    products: [
      p("Pedigree Adult Chicken 1.5kg", "Dog Food", "PET-001", 485, 24, 6, 8, 22),
      p("Royal Canin Mini Adult 2kg", "Dog Food", "PET-002", 890, 14, 4, 6, 28),
      p("Bow Wow Beef Chunks 400g", "Dog Food", "PET-003", 125, 38, 8, 7, 20),
      p("Good Boy Dry Food 3kg", "Dog Food", "PET-004", 320, 0, 5, 5, 24), // out of stock
      p("Whiskas Tuna 1.1kg", "Cat Food", "PET-010", 395, 28, 6, 9, 22),
      p("Friskies Seafood 1.2kg", "Cat Food", "PET-011", 285, 22, 6, 8, 20),
      p("Meow Mix Chicken 1.4kg", "Cat Food", "PET-012", 450, 3, 5, 6, 26), // low stock
      p("Fancy Feast Wet Cat Food 85g", "Cat Food", "PET-013", 65, 48, 12, 7, 30),
      p("DentaStix Small 7pcs", "Treats & Chews", "PET-020", 185, 32, 8, 7, 28),
      p("Beggin' Strips Bacon 170g", "Treats & Chews", "PET-021", 245, 18, 6, 6, 30),
      p("Catnip Mice Toy 3-pack", "Treats & Chews", "PET-022", 95, 0, 5, 4, 35), // out of stock
      p("Kong Classic Red Medium", "Toys", "PET-030", 650, 12, 4, 5, 32),
      p("Rope Tug Toy Large", "Toys", "PET-031", 180, 26, 6, 6, 28),
      p("Feather Wand Cat Toy", "Toys", "PET-032", 120, 34, 8, 7, 25),
      p("Squeaky Ball 3-pack", "Toys", "PET-033", 85, 2, 6, 5, 22), // low stock
      p("Furminator Deshedding Brush", "Grooming", "PET-040", 1250, 8, 3, 4, 35),
      p("Pet Shampoo Oatmeal 500ml", "Grooming", "PET-041", 285, 16, 5, 6, 28),
      p("Nail Clipper Small", "Grooming", "PET-042", 145, 3, 5, 4, 30), // low stock
      p("Ear Cleaning Solution 120ml", "Grooming", "PET-043", 195, 11, 4, 3, 32),
      p("Adjustable Collar Medium", "Accessories", "PET-050", 220, 28, 6, 6, 28),
      p("Retractable Leash 5m", "Accessories", "PET-051", 450, 14, 4, 5, 30),
      p("Pet Carrier Small", "Accessories", "PET-052", 890, 6, 3, 4, 32),
      p("Stainless Food Bowl Pair", "Accessories", "PET-053", 320, 22, 6, 7, 24),
      p("Cat Litter Bentonite 5kg", "Cat Supplies", "PET-060", 285, 4, 8, 8, 22), // low stock
      p("Litter Scoop & Pan Set", "Cat Supplies", "PET-061", 395, 9, 4, 5, 28),
      p("Aquarium Filter Cartridge", "Fish & Aquatics", "PET-070", 175, 0, 4, 3, 30), // out of stock
      p("Tropical Fish Flakes 50g", "Fish & Aquatics", "PET-071", 95, 18, 6, 5, 25),
      p("Hamster Bedding 2L", "Small Pets", "PET-080", 125, 0, 5, 3, 28), // out of stock
      p("Guinea Pig Pellets 1kg", "Small Pets", "PET-081", 210, 7, 4, 4, 26),
    ],
  },
  {
    name: "Brew & Bites Cafe",
    address: "12 Sunrise Lane, Tagaytay City",
    cashier: { name: "Liza Reyes", email: "cashier@demo.com" },
    dailySalesMin: 16,
    dailySalesMax: 28,
    openHour: 7,
    closeHour: 20,
    peakHours: [7, 8, 9, 12, 13, 15, 16, 17],
    products: [
      {
        name: "Americano",
        category: "Coffee",
        itemCode: "CAF-001",
        price: 95,
        stock: 0,
        lowStockThreshold: 0,
        marginPercentage: 65,
        popularity: 9,
        hasVariants: true,
        variants: [
          { name: "8oz", price: 95, stock: 999 },
          { name: "12oz", price: 115, stock: 999 },
          { name: "16oz", price: 135, stock: 999 },
        ],
      },
      {
        name: "Cafe Latte",
        category: "Coffee",
        itemCode: "CAF-002",
        price: 120,
        stock: 0,
        lowStockThreshold: 0,
        marginPercentage: 62,
        popularity: 10,
        hasVariants: true,
        variants: [
          { name: "8oz", price: 120, stock: 999 },
          { name: "12oz", price: 140, stock: 999 },
          { name: "16oz", price: 160, stock: 999 },
        ],
      },
      {
        name: "Cappuccino",
        category: "Coffee",
        itemCode: "CAF-003",
        price: 125,
        stock: 0,
        lowStockThreshold: 0,
        marginPercentage: 60,
        popularity: 8,
        hasVariants: true,
        variants: [
          { name: "8oz", price: 125, stock: 999 },
          { name: "12oz", price: 145, stock: 999 },
        ],
      },
      p("Espresso Single", "Coffee", "CAF-004", 75, 999, 0, 7, 70),
      p("Spanish Latte", "Coffee", "CAF-005", 145, 999, 0, 8, 65),
      p("Matcha Latte", "Coffee", "CAF-006", 155, 999, 0, 6, 68),
      p("House Blend Beans 250g", "Coffee", "CAF-007", 320, 18, 6, 4, 45),
      p("Matcha Powder 100g", "Coffee", "CAF-008", 450, 0, 3, 3, 50), // out of stock ingredient
      p("English Breakfast Tea", "Tea", "CAF-010", 85, 999, 0, 6, 72),
      p("Chamomile Tea", "Tea", "CAF-011", 85, 999, 0, 5, 72),
      p("Iced Tea Peach", "Tea", "CAF-012", 95, 999, 0, 7, 68),
      p("Milk Tea Brown Sugar", "Tea", "CAF-013", 125, 999, 0, 8, 65),
      p("Croissant Plain", "Pastries", "CAF-020", 75, 24, 8, 8, 55),
      p("Almond Croissant", "Pastries", "CAF-021", 95, 3, 8, 7, 58), // low stock
      p("Blueberry Muffin", "Pastries", "CAF-022", 85, 0, 6, 6, 52), // out of stock
      p("Chocolate Chip Cookie", "Pastries", "CAF-023", 55, 36, 10, 8, 48),
      p("Banana Bread Slice", "Pastries", "CAF-024", 65, 28, 8, 7, 50),
      p("Ensaymada", "Pastries", "CAF-025", 45, 42, 12, 9, 45),
      p("Ham & Cheese Sandwich", "Sandwiches", "CAF-030", 145, 16, 6, 7, 42),
      p("Tuna Melt Panini", "Sandwiches", "CAF-031", 165, 12, 5, 6, 44),
      p("Grilled Cheese", "Sandwiches", "CAF-032", 125, 8, 5, 7, 40),
      p("Clubhouse Sandwich", "Sandwiches", "CAF-033", 185, 0, 4, 5, 46), // out of stock
      p("Tapsilog Plate", "Breakfast & Meals", "CAF-040", 165, 999, 0, 8, 38),
      p("Longsilog Plate", "Breakfast & Meals", "CAF-041", 155, 999, 0, 7, 38),
      p("Pancake Stack (3pc)", "Breakfast & Meals", "CAF-042", 135, 999, 0, 6, 40),
      p("Beef Tapa Rice Bowl", "Breakfast & Meals", "CAF-043", 175, 999, 0, 5, 36),
      p("Iced Coffee", "Cold Drinks", "CAF-050", 110, 999, 0, 9, 65),
      p("Iced Chocolate", "Cold Drinks", "CAF-051", 115, 999, 0, 7, 62),
      p("Fresh Orange Juice", "Cold Drinks", "CAF-052", 125, 14, 6, 6, 55),
      p("Bottled Water 500ml", "Cold Drinks", "CAF-053", 35, 48, 12, 5, 35),
      p("Oat Milk 1L (barista)", "Supplies", "CAF-060", 185, 2, 5, 3, 30), // low stock
      p("Whipped Cream Can", "Supplies", "CAF-061", 220, 0, 3, 2, 32), // out of stock
    ],
  },
];

export const DEMO_SEED_DAYS = 30;
