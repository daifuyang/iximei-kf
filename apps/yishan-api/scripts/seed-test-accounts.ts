// One-off seed: pick first active hospital, insert 3 test users + 3 CrmHospitalAccount rows.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaClient } from '/home/dfy/workspace/products/iximei-kf/apps/yishan-api/src/generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 3306,
  allowPublicKeyRetrieval: true,
  connectionLimit: 2,
});

const prisma = new PrismaClient({ adapter });

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

async function main() {
  const hospital = await prisma.crmHospital.findFirst({
    where: { deletedAt: null, status: 1 },
    orderBy: { id: 'asc' },
    select: { id: true, hospitalName: true, creatorId: true, updaterId: true },
  });
  if (!hospital) {
    console.error('No active hospital found. Create a hospital first.');
    process.exit(1);
  }
  console.log('Target hospital:', hospital.id, hospital.hospitalName);

  const creatorId = hospital.creatorId ?? 1;
  const updaterId = hospital.updaterId ?? creatorId;

  const testUsers = [
    { username: 'test_owner_a', phone: '13800001001', realName: '测试负责人A', email: 'a@test.local', role: 'owner', password: 'Test@123' },
    { username: 'test_admin_a', phone: '13800001002', realName: '测试管理员A', email: 'b@test.local', role: 'admin', password: 'Test@123' },
    { username: 'test_member_a', phone: '13800001003', realName: '测试普通A', email: 'c@test.local', role: 'member', password: 'Test@123' },
  ];

  let inserted = 0;
  for (const u of testUsers) {
    const existing = await prisma.sysUser.findFirst({
      where: { username: u.username, deletedAt: null },
      select: { id: true },
    });
    let userId: number;
    if (existing) {
      userId = existing.id;
      console.log(`User ${u.username} exists (id=${userId}), reuse.`);
    } else {
      const created = await prisma.sysUser.create({
        data: {
          username: u.username,
          phone: u.phone,
          realName: u.realName,
          email: u.email,
          passwordHash: sha256(u.password),
          status: 1,
          creatorId,
          updaterId,
        },
        select: { id: true },
      });
      userId = created.id;
      console.log(`Created user ${u.username} (id=${userId}).`);
    }

    const existingRel = await prisma.crmHospitalAccount.findFirst({
      where: { hospitalId: hospital.id, userId, deletedAt: null },
      select: { id: true },
    });
    if (existingRel) {
      console.log(`Hospital-account relation already exists (id=${existingRel.id}).`);
      continue;
    }

    await prisma.crmHospitalAccount.create({
      data: {
        hospitalId: hospital.id,
        userId,
        role: u.role,
        status: 1,
        remark: '测试数据',
        creatorId,
        updaterId,
      },
    });
    inserted++;
    console.log(`Linked user ${userId} as ${u.role}.`);
  }

  console.log(`\nDone. Created ${inserted} new hospital-account row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
