import express from "express";
import cors from "cors";
import { listCategories as listCategoriesService } from "./services/categoryService";
import {
  listProducts as listProductsService,
  getProductById,
  createProduct as createProductService,
  deleteProduct as deleteProductService,
  updateProduct as updateProductService,
} from "./services/productService";
import {
  createSale as createSaleService,
  listSales as listSalesService,
  getSaleById,
} from "./services/saleService";
import {
  listVariantsByProduct,
  createVariant as createVariantService,
  updateVariant as updateVariantService,
  deleteVariant as deleteVariantService,
} from "./services/variantService";
import { prisma } from "./db";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Simple request logger to help debug 404s etc.
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth - finds existing user by email and uses stored role
app.post("/api/login", async (req, res) => {
  try {
    const { email, name } = req.body as {
      email: string;
      name?: string;
    };

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    // Do not auto-create users here; roles should be managed in the DB/seed
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Categories
app.get("/api/categories", async (_req, res) => {
  try {
    const categories = await listCategoriesService();
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// Products
app.get("/api/products", async (req, res) => {
  try {
    const { categoryId, search, status } = req.query as {
      categoryId?: string;
      search?: string;
      status?: "active" | "inactive";
    };

    const products = await listProductsService({
      categoryId: categoryId || null,
      search,
      status,
    });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const product = await createProductService(req.body);
    res.status(201).json(product);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to create product" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const product = await updateProductService(req.params.id, req.body);
    res.json(product);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to update product" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await deleteProductService(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to delete product" });
  }
});

// Variants
app.get("/api/products/:productId/variants", async (req, res) => {
  try {
    const variants = await listVariantsByProduct(req.params.productId);
    res.json(variants);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message ?? "Failed to fetch variants" });
  }
});

app.post("/api/products/:productId/variants", async (req, res) => {
  try {
    const { name, price, stock } = req.body as {
      name: string;
      price: number;
      stock: number;
    };
    const variant = await createVariantService(req.params.productId, {
      name,
      price,
      stock,
    });
    res.status(201).json(variant);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to create variant" });
  }
});

app.put("/api/variants/:id", async (req, res) => {
  try {
    const variant = await updateVariantService(req.params.id, req.body);
    res.json(variant);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to update variant" });
  }
});

app.delete("/api/variants/:id", async (req, res) => {
  try {
    await deleteVariantService(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to delete variant" });
  }
});

// Sales
app.get("/api/sales", async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const sales = await listSalesService({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    res.json(sales);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch sales" });
  }
});

app.get("/api/sales/:id", async (req, res) => {
  try {
    const sale = await getSaleById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }
    res.json(sale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch sale" });
  }
});

app.post("/api/sales", async (req, res) => {
  try {
    const sale = await createSaleService(req.body);
    res.status(201).json(sale);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to create sale" });
  }
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});


