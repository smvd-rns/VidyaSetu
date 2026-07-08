import bcrypt from 'bcrypt';
import {
  GlobalRole,
  CenterStatus,
  SubscriptionStatus,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@vidyasetu.local';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Super admin already exists:', email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      globalRole: GlobalRole.SUPER_ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('Created super admin:', email);
  console.log('Default password:', password);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
