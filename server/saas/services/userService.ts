import bcrypt from "bcryptjs";
import { saasPrisma } from "../db.js";

export async function getUsersByOrganization(organizationId: string) {
  return saasPrisma.user.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      createdAt: true,
      storeAccess: {
        include: { store: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function getUsersByStore(storeId: string) {
  const store = await saasPrisma.store.findUnique({
    where: { id: storeId },
    include: {
      userAccess: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              organizationId: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  if (!store) throw new Error("Store not found");
  return store.userAccess.map((ua) => ua.user);
}

export async function getUserById(id: string, organizationId: string | null) {
  const user = await saasPrisma.user.findUnique({
    where: { id },
  });
  if (!user) return null;
  if (organizationId && user.organizationId !== organizationId) return null;
  return user;
}

export async function getUserByEmail(email: string) {
  return saasPrisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

export async function createUser(
  organizationId: string,
  storeIds: string[],
  input: {
    name: string;
    email: string;
    password: string;
    role: "owner" | "admin" | "cashier";
  }
) {
  const existing = await saasPrisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existing) throw new Error("Email already registered");

  const hashedPassword = await bcrypt.hash(input.password, 10);

  return saasPrisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId,
        name: input.name,
        email: input.email.toLowerCase(),
        password: hashedPassword,
        role: input.role,
      },
    });

    for (const storeId of storeIds) {
      await tx.userStore.create({
        data: { userId: user.id, storeId },
      });
    }

    const { password: _p, ...sanitized } = user;
    return sanitized;
  });
}

export async function updateUser(
  id: string,
  organizationId: string,
  input: Partial<{
    name: string;
    email: string;
    password: string;
    role: string;
    storeIds: string[];
  }>
) {
  const existing = await saasPrisma.user.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new Error("User not found");

  const { storeIds, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };
  if (input.password) {
    data.password = await bcrypt.hash(input.password, 10);
  }
  if (input.email) {
    data.email = input.email.toLowerCase();
  }

  const user = await saasPrisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data,
    });
    if (storeIds !== undefined) {
      await tx.userStore.deleteMany({ where: { userId: id } });
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        include: { stores: { select: { id: true } } },
      });
      const validIds = (storeIds || []).filter((sid) =>
        org?.stores.some((s) => s.id === sid)
      );
      const toAssign = validIds.length > 0 ? validIds : org?.stores.map((s) => s.id) ?? [];
      for (const storeId of toAssign) {
        await tx.userStore.create({
          data: { userId: id, storeId },
        });
      }
    }
    return updated;
  });
  const { password: _p, ...sanitized } = user;
  return sanitized;
}

export async function deleteUser(id: string, organizationId: string) {
  const existing = await saasPrisma.user.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new Error("User not found");

  await saasPrisma.userStore.deleteMany({ where: { userId: id } });
  return saasPrisma.user.delete({ where: { id } });
}
