
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  plan: 'plan',
  phone: 'phone',
  email: 'email',
  address: 'address',
  stripeCustomerId: 'stripeCustomerId',
  billingDueDate: 'billingDueDate',
  trialEndsAt: 'trialEndsAt',
  createdAt: 'createdAt'
};

exports.Prisma.OrganizationNotificationScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  message: 'message',
  type: 'type',
  createdAt: 'createdAt',
  expiresAt: 'expiresAt'
};

exports.Prisma.StoreScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  name: 'name',
  address: 'address',
  receiptLogoUrl: 'receiptLogoUrl',
  businessMode: 'businessMode',
  createdAt: 'createdAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  name: 'name',
  email: 'email',
  password: 'password',
  role: 'role',
  createdAt: 'createdAt'
};

exports.Prisma.UserStoreScalarFieldEnum = {
  userId: 'userId',
  storeId: 'storeId'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  storeId: 'storeId',
  name: 'name'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  storeId: 'storeId',
  name: 'name',
  categoryId: 'categoryId',
  itemCode: 'itemCode',
  sku: 'sku',
  hasVariants: 'hasVariants',
  basePrice: 'basePrice',
  price: 'price',
  stock: 'stock',
  lowStockThreshold: 'lowStockThreshold',
  marginPercentage: 'marginPercentage',
  status: 'status',
  image: 'image',
  barcode: 'barcode',
  qrCode: 'qrCode',
  unitOfMeasure: 'unitOfMeasure'
};

exports.Prisma.VariantScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  name: 'name',
  price: 'price',
  stock: 'stock'
};

exports.Prisma.SaleScalarFieldEnum = {
  id: 'id',
  storeId: 'storeId',
  ticketNumber: 'ticketNumber',
  cashierId: 'cashierId',
  cashierName: 'cashierName',
  total: 'total',
  paymentMethod: 'paymentMethod',
  amountReceived: 'amountReceived',
  change: 'change',
  status: 'status',
  gcashTransactionId: 'gcashTransactionId',
  createdAt: 'createdAt'
};

exports.Prisma.IngredientScalarFieldEnum = {
  id: 'id',
  storeId: 'storeId',
  name: 'name',
  sku: 'sku',
  barcode: 'barcode',
  stock: 'stock',
  lowStockThreshold: 'lowStockThreshold',
  unitOfMeasure: 'unitOfMeasure',
  status: 'status'
};

exports.Prisma.MenuCategoryScalarFieldEnum = {
  id: 'id',
  storeId: 'storeId',
  name: 'name'
};

exports.Prisma.MenuItemScalarFieldEnum = {
  id: 'id',
  storeId: 'storeId',
  menuCategoryId: 'menuCategoryId',
  name: 'name',
  price: 'price',
  status: 'status',
  image: 'image',
  barcode: 'barcode'
};

exports.Prisma.RecipeLineScalarFieldEnum = {
  id: 'id',
  menuItemId: 'menuItemId',
  ingredientId: 'ingredientId',
  quantity: 'quantity',
  wastagePercent: 'wastagePercent'
};

exports.Prisma.SaleItemScalarFieldEnum = {
  id: 'id',
  saleId: 'saleId',
  productId: 'productId',
  menuItemId: 'menuItemId',
  variantId: 'variantId',
  productName: 'productName',
  variantName: 'variantName',
  quantity: 'quantity',
  price: 'price',
  subtotal: 'subtotal'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Organization: 'Organization',
  OrganizationNotification: 'OrganizationNotification',
  Store: 'Store',
  User: 'User',
  UserStore: 'UserStore',
  Category: 'Category',
  Product: 'Product',
  Variant: 'Variant',
  Sale: 'Sale',
  Ingredient: 'Ingredient',
  MenuCategory: 'MenuCategory',
  MenuItem: 'MenuItem',
  RecipeLine: 'RecipeLine',
  SaleItem: 'SaleItem'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
