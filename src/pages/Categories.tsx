import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FolderPlus, Search, Trash2, Edit } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Category } from "@/types/pos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Categories = () => {
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const categoriesList = await api.getCategories();
      setCategories(categoriesList as Category[]);
    } catch (e: any) {
      setError(e.message ?? "Failed to load categories");
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message ?? "Failed to load categories",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );
  const isEditing = !!editingCategory;

  const openAddDialog = () => {
    setEditingCategory(null);
    setFormName("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError("Category name is required");
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      if (isEditing) {
        await api.updateCategory(editingCategory.id, { name: formName.trim() });
        toast({
          title: "Category updated",
          description: `${formName} has been updated successfully.`,
        });
      } else {
        await api.createCategory({ name: formName.trim() });
        toast({
          title: "Category created",
          description: `${formName} has been created successfully.`,
        });
      }

      setFormOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e.message ?? "Failed to save category");
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message ?? "Failed to save category",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    try {
      await api.deleteCategory(deletingCategory.id);
      toast({
        title: "Category deleted",
        description: `${deletingCategory.name} has been deleted.`,
      });
      setDeletingCategory(null);
      await load();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message ?? "Failed to delete category",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Category Management</h1>
          <p className="text-muted-foreground">Organize your products by categories</p>
        </div>
        <Button onClick={openAddDialog} className="w-full md:w-auto">
          <FolderPlus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    {search ? "No categories found matching your search" : "No categories found"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingCategory(category)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Category" : "Add New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Electronics, Food, Clothing"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingCategory?.name}</strong>? This action
              cannot be undone. Products in this category will need to be reassigned to another category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Categories;

