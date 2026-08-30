/**
 * Themed demo store catalogs for SaaS seed (convenience, pet shop, cafe).
 * Stock levels: healthy (plenty), low (at/below threshold), out (0).
 */

export interface VariantSeed {
  name: string;
  price: number;
  stock: number;
}

export interface ProductSeed {
  name: string;
  category: string;
  itemCode: string;
  price?: number;
  stock?: number;
  lowStockThreshold: number;
  marginPercentage?: number;
  hasVariants?: boolean;
  variants?: VariantSeed[];
  /** Bias toward this item in generated sales (1 = normal, 3 = popular). */
  popularity?: number;
}

export interface StoreSeed {
  name: string;
  address: string;
  ticketPrefix: string;
  categories: string[];
  products: ProductSeed[];
  /** Hour weights for sale timestamps [0-23]. */
  peakHours: number[];
  cashierEmail: string;
}

export const DEMO_STORES: StoreSeed[] = [
  {
    name: "Sari-Sari Corner",
    address: "Purok 3, Barangay Maligaya, Laguna",
    ticketPrefix: "SARI",
    cashierEmail: "maria@demo.com",
    peakHours: [7, 8, 11, 12, 17, 18, 19],
    categories: ["Snacks", "Drinks", "Pantry", "Household", "Personal Care", "School & Office"],
    products: [
      { name: "Lucky Me Pancit Canton", category: "Snacks", itemCode: "SARI-001", price: 15, stock: 48, lowStockThreshold: 20, marginPercentage: 22, popularity: 3 },
      { name: "SkyFlakes Crackers", category: "Snacks", itemCode: "SARI-002", price: 12, stock: 55, lowStockThreshold: 15, marginPercentage: 20, popularity: 2 },
      { name: "Nova Country Cheddar", category: "Snacks", itemCode: "SARI-003", price: 20, stock: 6, lowStockThreshold: 12, marginPercentage: 25, popularity: 2 },
      { name: "Bingo Sandwich Cookies", category: "Snacks", itemCode: "SARI-004", price: 10, stock: 38, lowStockThreshold: 15, marginPercentage: 18 },
      { name: "Piattos Cheese", category: "Snacks", itemCode: "SARI-005", price: 25, stock: 0, lowStockThreshold: 10, marginPercentage: 24 },
      { name: "Coke", category: "Drinks", itemCode: "SARI-006", lowStockThreshold: 12, marginPercentage: 28, hasVariants: true, popularity: 3, variants: [
        { name: "330ml", price: 20, stock: 42 },
        { name: "500ml", price: 28, stock: 35 },
        { name: "1.5L", price: 65, stock: 18 },
      ]},
      { name: "Royal Tru-Orange", category: "Drinks", itemCode: "SARI-007", price: 22, stock: 26, lowStockThreshold: 12, marginPercentage: 26, popularity: 2 },
      { name: "Bear Brand Swak 300ml", category: "Drinks", itemCode: "SARI-008", price: 18, stock: 4, lowStockThreshold: 10, marginPercentage: 20 },
      { name: "C2 Green Tea", category: "Drinks", itemCode: "SARI-009", price: 15, stock: 0, lowStockThreshold: 8, marginPercentage: 22 },
      { name: "Mineral Water 500ml", category: "Drinks", itemCode: "SARI-010", price: 12, stock: 88, lowStockThreshold: 25, marginPercentage: 35, popularity: 3 },
      { name: "Yakult 5-pack", category: "Drinks", itemCode: "SARI-011", price: 55, stock: 11, lowStockThreshold: 12, marginPercentage: 18 },
      { name: "Ligo Sardines", category: "Pantry", itemCode: "SARI-012", price: 28, stock: 52, lowStockThreshold: 15, marginPercentage: 15, popularity: 2 },
      { name: "Argentina Corned Beef", category: "Pantry", itemCode: "SARI-013", price: 45, stock: 30, lowStockThreshold: 12, marginPercentage: 14 },
      { name: "Sinandomeng Rice 1kg", category: "Pantry", itemCode: "SARI-014", price: 55, stock: 22, lowStockThreshold: 10, marginPercentage: 12, popularity: 2 },
      { name: "Nescafe 3-in-1", category: "Pantry", itemCode: "SARI-015", price: 8, stock: 95, lowStockThreshold: 30, marginPercentage: 30, popularity: 3 },
      { name: "Champion Bar 400g", category: "Household", itemCode: "SARI-016", price: 18, stock: 0, lowStockThreshold: 8, marginPercentage: 20 },
      { name: "Surf Detergent Sachet", category: "Household", itemCode: "SARI-017", price: 8, stock: 24, lowStockThreshold: 15, marginPercentage: 22 },
      { name: "Safeguard Soap 135g", category: "Personal Care", itemCode: "SARI-018", price: 38, stock: 16, lowStockThreshold: 10, marginPercentage: 18 },
      { name: "Colgate Sachet", category: "Personal Care", itemCode: "SARI-019", price: 12, stock: 5, lowStockThreshold: 10, marginPercentage: 25 },
      { name: "Bond Paper Short", category: "School & Office", itemCode: "SARI-020", price: 85, stock: 36, lowStockThreshold: 10, marginPercentage: 15 },
      { name: "Pilot Pen Blue", category: "School & Office", itemCode: "SARI-021", price: 15, stock: 42, lowStockThreshold: 12, marginPercentage: 28 },
    ],
  },
  {
    name: "Paws & Claws Pet Shoppe",
    address: "Unit 4, Pet Lover's Arcade, Quezon City",
    ticketPrefix: "PET",
    cashierEmail: "juan@demo.com",
    peakHours: [10, 11, 14, 15, 16, 17, 18],
    categories: ["Dog Food", "Cat Supplies", "Toys", "Grooming", "Accessories", "Treats"],
    products: [
      { name: "Pedigree Adult 1.5kg", category: "Dog Food", itemCode: "PET-001", price: 485, stock: 20, lowStockThreshold: 8, marginPercentage: 18, popularity: 3 },
      { name: "Bow Wow Dry Food 2kg", category: "Dog Food", itemCode: "PET-002", price: 320, stock: 14, lowStockThreshold: 6, marginPercentage: 20, popularity: 2 },
      { name: "Whiskas Cat Food 1kg", category: "Cat Supplies", itemCode: "PET-003", price: 265, stock: 16, lowStockThreshold: 8, marginPercentage: 19, popularity: 3 },
      { name: "Cat Litter 5kg", category: "Cat Supplies", itemCode: "PET-004", price: 195, stock: 12, lowStockThreshold: 6, marginPercentage: 22, popularity: 2 },
      { name: "Training Pads 30pc", category: "Dog Food", itemCode: "PET-005", price: 350, stock: 0, lowStockThreshold: 5, marginPercentage: 25 },
      { name: "Rubber Ball Toy", category: "Toys", itemCode: "PET-006", price: 85, stock: 40, lowStockThreshold: 10, marginPercentage: 35 },
      { name: "Rope Chew Toy", category: "Toys", itemCode: "PET-007", price: 120, stock: 0, lowStockThreshold: 8, marginPercentage: 32 },
      { name: "Feather Wand Cat Toy", category: "Toys", itemCode: "PET-008", price: 95, stock: 22, lowStockThreshold: 8, marginPercentage: 40 },
      { name: "Flea & Tick Shampoo", category: "Grooming", itemCode: "PET-009", price: 175, stock: 5, lowStockThreshold: 8, marginPercentage: 28 },
      { name: "Pet Nail Clipper", category: "Grooming", itemCode: "PET-010", price: 145, stock: 11, lowStockThreshold: 5, marginPercentage: 30 },
      { name: "Dog Shampoo 500ml", category: "Grooming", itemCode: "PET-011", price: 210, stock: 15, lowStockThreshold: 6, marginPercentage: 26 },
      { name: "Stainless Dog Bowl", category: "Accessories", itemCode: "PET-012", price: 185, stock: 18, lowStockThreshold: 6, marginPercentage: 32 },
      { name: "Dog Leash Medium", category: "Accessories", itemCode: "PET-013", price: 220, stock: 7, lowStockThreshold: 8, marginPercentage: 30, popularity: 2 },
      { name: "Cat Carrier Small", category: "Accessories", itemCode: "PET-014", price: 890, stock: 3, lowStockThreshold: 4, marginPercentage: 22 },
      { name: "Collar Small", category: "Accessories", itemCode: "PET-015", price: 95, stock: 19, lowStockThreshold: 8, marginPercentage: 38 },
      { name: "Chew Bone Large", category: "Treats", itemCode: "PET-016", price: 65, stock: 38, lowStockThreshold: 12, marginPercentage: 42, popularity: 2 },
      { name: "Chicken Jerky Treats", category: "Treats", itemCode: "PET-017", price: 125, stock: 28, lowStockThreshold: 10, marginPercentage: 35, popularity: 2 },
      { name: "Fish Food Flakes", category: "Cat Supplies", itemCode: "PET-018", price: 75, stock: 24, lowStockThreshold: 8, marginPercentage: 40 },
      { name: "Hamster Bedding 1kg", category: "Accessories", itemCode: "PET-019", price: 110, stock: 0, lowStockThreshold: 5, marginPercentage: 30 },
      { name: "Aquarium Filter Small", category: "Accessories", itemCode: "PET-020", price: 450, stock: 4, lowStockThreshold: 5, marginPercentage: 25 },
    ],
  },
  {
    name: "Brew & Bites Cafe",
    address: "12 Mabini St, Lipa City, Batangas",
    ticketPrefix: "CAFE",
    cashierEmail: "cashier@demo.com",
    peakHours: [7, 8, 9, 12, 13, 15, 16, 17],
    categories: ["Hot Coffee", "Iced Drinks", "Pastries", "Sandwiches", "Rice Meals"],
    products: [
      { name: "Americano", category: "Hot Coffee", itemCode: "CAFE-001", price: 120, stock: 500, lowStockThreshold: 50, marginPercentage: 65, popularity: 3 },
      { name: "Cappuccino", category: "Hot Coffee", itemCode: "CAFE-002", price: 140, stock: 500, lowStockThreshold: 50, marginPercentage: 62, popularity: 3 },
      { name: "Spanish Latte", category: "Hot Coffee", itemCode: "CAFE-003", price: 150, stock: 500, lowStockThreshold: 50, marginPercentage: 60, popularity: 2 },
      { name: "Matcha Latte", category: "Hot Coffee", itemCode: "CAFE-004", price: 165, stock: 0, lowStockThreshold: 20, marginPercentage: 58 },
      { name: "Iced Latte", category: "Iced Drinks", itemCode: "CAFE-005", price: 160, stock: 500, lowStockThreshold: 50, marginPercentage: 60, popularity: 3 },
      { name: "Iced Americano", category: "Iced Drinks", itemCode: "CAFE-006", price: 130, stock: 500, lowStockThreshold: 50, marginPercentage: 63, popularity: 2 },
      { name: "Mango Shake", category: "Iced Drinks", itemCode: "CAFE-007", price: 145, stock: 18, lowStockThreshold: 10, marginPercentage: 55, popularity: 2 },
      { name: "House Iced Tea", category: "Iced Drinks", itemCode: "CAFE-008", price: 95, stock: 72, lowStockThreshold: 20, marginPercentage: 70 },
      { name: "Croissant", category: "Pastries", itemCode: "CAFE-009", price: 85, stock: 4, lowStockThreshold: 8, marginPercentage: 45, popularity: 2 },
      { name: "Ensaymada", category: "Pastries", itemCode: "CAFE-010", price: 45, stock: 22, lowStockThreshold: 10, marginPercentage: 50, popularity: 2 },
      { name: "Banana Bread Slice", category: "Pastries", itemCode: "CAFE-011", price: 65, stock: 14, lowStockThreshold: 8, marginPercentage: 48 },
      { name: "Blueberry Muffin", category: "Pastries", itemCode: "CAFE-012", price: 75, stock: 3, lowStockThreshold: 6, marginPercentage: 46 },
      { name: "Ham & Cheese Panini", category: "Sandwiches", itemCode: "CAFE-013", price: 165, stock: 7, lowStockThreshold: 8, marginPercentage: 42, popularity: 2 },
      { name: "Tuna Melt", category: "Sandwiches", itemCode: "CAFE-014", price: 155, stock: 10, lowStockThreshold: 8, marginPercentage: 40 },
      { name: "Club Sandwich", category: "Sandwiches", itemCode: "CAFE-015", price: 185, stock: 0, lowStockThreshold: 6, marginPercentage: 38 },
      { name: "Tapsilog", category: "Rice Meals", itemCode: "CAFE-016", price: 145, stock: 14, lowStockThreshold: 8, marginPercentage: 38, popularity: 2 },
      { name: "Longsilog", category: "Rice Meals", itemCode: "CAFE-017", price: 135, stock: 12, lowStockThreshold: 8, marginPercentage: 36 },
      { name: "Pancakes (3pc)", category: "Rice Meals", itemCode: "CAFE-018", price: 125, stock: 9, lowStockThreshold: 8, marginPercentage: 44 },
      { name: "Bottled Water", category: "Iced Drinks", itemCode: "CAFE-019", price: 35, stock: 48, lowStockThreshold: 15, marginPercentage: 55 },
      { name: "Oat Milk Add-on", category: "Hot Coffee", itemCode: "CAFE-020", price: 35, stock: 2, lowStockThreshold: 5, marginPercentage: 50 },
    ],
  },
];

export const SALES_PER_STORE = 100;
export const SALES_HISTORY_DAYS = 30;
