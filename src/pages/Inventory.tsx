import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockProducts, mockCategories } from "@/lib/mockData";
import { Plus, Search, AlertTriangle } from "lucide-react";

const Inventory = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your products and stock levels</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-10" />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockProducts.map((product) => {
              const category = mockCategories.find((c) => c.id === product.categoryId);
              const totalStock = product.hasVariants
                ? product.variants?.reduce((sum, v) => sum + v.stock, 0)
                : product.stock;
              const isLowStock = (totalStock || 0) <= product.lowStockThreshold;

              return (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{category?.name}</TableCell>
                  <TableCell>
                    {product.hasVariants ? (
                      <Badge variant="outline">{product.variants?.length} variants</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isLowStock && (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      )}
                      <span className={isLowStock ? "text-destructive font-semibold" : ""}>
                        {totalStock}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    ${product.hasVariants ? product.variants?.[0]?.price : product.price}
                    {product.hasVariants && "+"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === "active" ? "default" : "secondary"}>
                      {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Inventory;
