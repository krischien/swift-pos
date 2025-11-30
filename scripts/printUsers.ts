import { prisma } from "../server/db";

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users:", users);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


