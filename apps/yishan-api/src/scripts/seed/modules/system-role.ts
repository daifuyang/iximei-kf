import { eq } from 'drizzle-orm';
import { sysRole, sysUserRole } from '@/db/schema';
import { rolesSeed } from '../config.js';
import type { SeedDb } from '../context.js';
import { ROLE_IDS } from '@/constants/permission-codes.js';

type RoleSeedShape = {
  name: string
  description: string
  /** 数据权限范围（1-5）。详见 DataScopeCode。 */
  dataScope: number
};

async function ensureRole(
  db: SeedDb,
  roleId: number,
  roleSeed: RoleSeedShape,
  adminUserId: number,
) {
  await db
    .insert(sysRole)
    .values({
      id: roleId,
      name: roleSeed.name,
      description: roleSeed.description,
      status: 1,
      isSystemDefault: true,
      dataScope: roleSeed.dataScope,
      creatorId: adminUserId,
      updaterId: adminUserId,
    })
    .onDuplicateKeyUpdate({
      set: { name: roleSeed.name, dataScope: roleSeed.dataScope },
    });

  const role = await db.query.sysRole.findFirst({ where: eq(sysRole.name, roleSeed.name) });
  if (!role) {
    throw new Error(`系统角色数据写入后未找到: ${roleSeed.name}`);
  }
  return role;
}

export async function ensureSystemRoles(db: SeedDb, adminUserId: number) {
  const superAdminRole = await ensureRole(db, ROLE_IDS.SUPER_ADMIN, rolesSeed.superAdmin, adminUserId);
  const adminRole = await ensureRole(db, ROLE_IDS.ADMIN, rolesSeed.admin, adminUserId);
  const hospitalAccountRole = await ensureRole(db, ROLE_IDS.HOSPITAL_ACCOUNT, rolesSeed.hospitalAccount, adminUserId);
  const customerServiceRole = await ensureRole(db, ROLE_IDS.CUSTOMER_SERVICE, rolesSeed.customerService, adminUserId);

  console.log('系统默认角色已准备:', {
    superAdmin: `${superAdminRole.name} (dataScope=${superAdminRole.dataScope})`,
    normalAdmin: `${adminRole.name} (dataScope=${adminRole.dataScope})`,
    hospitalAccount: `${hospitalAccountRole.name} (dataScope=${hospitalAccountRole.dataScope})`,
    customerService: `${customerServiceRole.name} (dataScope=${customerServiceRole.dataScope})`,
  });

  return { superAdminRole, adminRole, hospitalAccountRole, customerServiceRole };
}

export async function bindUserRole(db: SeedDb, userId: number, roleId: number) {
  await db
    .insert(sysUserRole)
    .values({ userId, roleId })
    .onDuplicateKeyUpdate({ set: { userId, roleId } });
}
