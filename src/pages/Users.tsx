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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2, Edit, UserPlus, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { User } from "@/types/pos";
import { isSaaS } from "@/config/appMode";
import { getOrgStores } from "@/lib/saasOrgStoresApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TierLimitModal } from "@/components/TierLimitModal";
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
import { Skeleton } from "@/components/ui/skeleton";

const Users = () => {
  const dataService = useDataLayer();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"owner" | "cashier">("cashier");
  const [formStoreIds, setFormStoreIds] = useState<string[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [limitModal, setLimitModal] = useState<{
    open: boolean;
    message?: string;
    tier?: string;
    max?: number | null;
    upgradeTo?: string | null;
  }>({ open: false });
  const { toast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const usersList = await dataService.getUsers();
      setUsers(usersList as User[]);
    } catch (e: any) {
      setError(e.message ?? "Failed to load users");
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message ?? "Failed to load users",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (isSaaS()) {
      void getOrgStores().then(setStores).catch(() => setStores([]));
    }
  }, []);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filtered.slice(startIndex, startIndex + itemsPerPage);
  const isEditing = !!editingUser;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openAddDialog = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("cashier");
    setFormStoreIds([]);
    setShowPassword(false);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword(""); // Don't prefill password
    // Owners can only assign owner or cashier; default to cashier when editing admin
    setFormRole(user.role === "owner" || user.role === "cashier" ? user.role : "cashier");
    setFormStoreIds(user.storeIds ?? []);
    setShowPassword(false);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      setFormError("Name and email are required");
      return;
    }

    if (!isEditing && !formPassword.trim()) {
      setFormError("Password is required for new users");
      return;
    }

    if (formPassword.trim() && formPassword.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      if (isEditing) {
        const updateData: any = {
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
        };
        if (formPassword.trim()) {
          updateData.password = formPassword;
        }
        if (isSaaS() && stores.length > 0) {
          updateData.storeIds = formStoreIds;
        }
        await dataService.updateUser(editingUser.id, updateData);
        toast({
          title: "User updated",
          description: `${formName} has been updated successfully.`,
        });
      } else {
        const createPayload: any = {
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          role: formRole,
        };
        if (isSaaS() && stores.length > 0) {
          createPayload.storeIds = formStoreIds;
        }
        await dataService.createUser(createPayload);
        toast({
          title: "User created",
          description: `${formName} has been created successfully.`,
        });
      }

      setFormOpen(false);
      await load();
    } catch (e: any) {
      if (e?.code === "TIER_LIMIT_USER" || /limitasyon|TIER_LIMIT_USER|user limit/i.test(e?.message ?? "")) {
        setFormOpen(false);
        setLimitModal({
          open: true,
          message: e.message,
          tier: e.tier,
          max: e.max,
          upgradeTo: e.upgradeTo,
        });
      } else {
        setFormError(e.message ?? "Failed to save user");
        toast({
          variant: "destructive",
          title: "Error",
          description: e.message ?? "Failed to save user",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    try {
      await dataService.deleteUser(deletingUser.id);
      toast({
        title: "User deleted",
        description: `${deletingUser.name} has been deleted.`,
      });
      setDeletingUser(null);
      await load();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message ?? "Failed to delete user",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <TierLimitModal
        open={limitModal.open}
        onOpenChange={(open) => setLimitModal((s) => ({ ...s, open }))}
        kind="user"
        tier={limitModal.tier}
        max={limitModal.max}
        upgradeTo={limitModal.upgradeTo}
        message={limitModal.message}
      />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage system users and their roles</p>
        </div>
        <Button onClick={openAddDialog} className="w-full md:w-auto" data-testid="users-add">
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
          <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <>
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {isSaaS() && <TableHead>Stores</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                    {isSaaS() && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-14" />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          {search ? "No users found matching your search" : "No users found"}
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {isSaaS() && stores.length > 0 && <TableHead>Stores</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "owner" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    {isSaaS() && stores.length > 0 && (
                      <TableCell className="text-muted-foreground text-sm">
                        {!user.storeIds?.length
                          ? "All stores"
                          : user.storeIds
                              .map((sid) => stores.find((s) => s.id === sid)?.name ?? sid)
                              .join(", ")}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingUser(user)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedUsers.map((user) => (
              <div key={user.id} className="bg-card rounded-lg border p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold">{user.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                  </div>
                  <Badge variant={user.role === "owner" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </div>
                {isSaaS() && stores.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {!user.storeIds?.length
                      ? "All stores"
                      : user.storeIds
                          .map((sid) => stores.find((s) => s.id === sid)?.name ?? sid)
                          .join(", ")}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => openEditDialog(user)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive"
                    onClick={() => setDeletingUser(user)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center gap-1">
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1">…</span>}
                      <Button
                        variant={currentPage === p ? "default" : "outline"}
                        size="sm"
                        className="min-w-8 h-8 p-0"
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </Button>
                    </span>
                  ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {isEditing && "(leave blank to keep current)"}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={isEditing ? "Enter new password" : "Enter password"}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as "owner" | "cashier")}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isSaaS() && stores.length > 0 && (
              <div className="space-y-2">
                <Label>Stores</Label>
                <p className="text-xs text-muted-foreground">
                  Select stores this user can access. Leave all unchecked to grant access to all stores.
                </p>
                <div className="space-y-2 pt-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {stores.map((s) => (
                    <div key={s.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`store-${s.id}`}
                        checked={formStoreIds.includes(s.id)}
                        onCheckedChange={(checked) => {
                          setFormStoreIds((prev) =>
                            checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                          );
                        }}
                      />
                      <label
                        htmlFor={`store-${s.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {s.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingUser?.name}</strong>? This action
              cannot be undone.
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

export default Users;

