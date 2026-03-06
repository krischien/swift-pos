import { api } from "@/lib/api";
import type { DataService } from "./types";

/**
 * Solo mode data service. Uses existing api (which routes to mobileServices on native, server on web).
 * Ignores storeId - single tenant, single store.
 */
export const soloDataService: DataService = {
  login: (payload) => api.login(payload) as Promise<any>,

  getCategories: () => api.getCategories() as Promise<any>,
  createCategory: (payload) => api.createCategory(payload) as Promise<any>,
  updateCategory: (id, payload) => api.updateCategory(id, payload) as Promise<any>,
  deleteCategory: (id) => api.deleteCategory(id) as Promise<any>,

  getProducts: (params) => api.getProducts(params) as Promise<any>,
  createProduct: (payload) => api.createProduct(payload) as Promise<any>,
  updateProduct: (id, payload) => api.updateProduct(id, payload) as Promise<any>,
  deleteProduct: (id) => api.deleteProduct(id) as Promise<any>,

  getVariants: (productId) => api.getVariants(productId) as Promise<any>,
  createVariant: (productId, payload) =>
    api.createVariant(productId, payload) as Promise<any>,
  updateVariant: (id, payload) => api.updateVariant(id, payload) as Promise<any>,
  deleteVariant: (id) => api.deleteVariant(id) as Promise<any>,

  getSales: (params) => api.getSales(params) as Promise<any>,
  createSale: (payload) => api.createSale(payload) as Promise<any>,

  getUsers: () => api.getUsers() as Promise<any>,
  createUser: (payload) => api.createUser(payload) as Promise<any>,
  updateUser: (id, payload) => api.updateUser(id, payload) as Promise<any>,
  deleteUser: (id) => api.deleteUser(id) as Promise<any>,
};
