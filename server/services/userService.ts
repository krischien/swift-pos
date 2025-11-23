import { prisma } from "../db";

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createUser(input: {
  name: string;
  email: string;
  role: "admin" | "cashier";
}) {
  return prisma.user.create({
    data: input,
  });
}

export async function updateUser(
  id: string,
  input: Partial<{
    name: string;
    email: string;
    role: "admin" | "cashier";
  }>,
) {
  return prisma.user.update({
    where: { id },
    data: input,
  });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({
    where: { id },
  });
}


