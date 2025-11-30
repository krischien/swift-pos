import bcrypt from "bcryptjs";
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
  password: string;
  role: "admin" | "cashier";
}) {
  const hashedPassword = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: {
      ...input,
      password: hashedPassword,
    },
  });
}

export async function updateUser(
  id: string,
  input: Partial<{
    name: string;
    email: string;
    password: string;
    role: "admin" | "cashier";
  }>,
) {
  const data = { ...input } as typeof input;
  if (input.password) {
    (data as any).password = await bcrypt.hash(input.password, 10);
  }
  return prisma.user.update({
    where: { id },
    data,
  });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({
    where: { id },
  });
}


