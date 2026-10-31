import prisma from '../src/config/prisma.js';

async function backfillNulls() {
  console.log('🔄 Backfilling records with NULL tenantId...');

  // 1. Backfill Clients where tenantId is null using branchId
  const clientsWithNull = await prisma.client.findMany({
    where: { tenantId: null },
    select: { id: true, branchId: true }
  });
  console.log(`Found ${clientsWithNull.length} clients with NULL tenantId`);

  for (const c of clientsWithNull) {
    const branch = await prisma.branch.findUnique({ where: { id: c.branchId }, select: { tenantId: true } });
    if (branch?.tenantId) {
      await prisma.client.update({
        where: { id: c.id },
        data: { tenantId: branch.tenantId }
      });
    }
  }

  // 2. Backfill AuditEvents where tenantId is null
  const auditsWithNull = await prisma.auditEvent.findMany({
    where: { tenantId: null },
    select: { id: true, branchId: true }
  });
  console.log(`Found ${auditsWithNull.length} audit events with NULL tenantId`);

  for (const a of auditsWithNull) {
    let tenantId = null;
    if (a.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: a.branchId }, select: { tenantId: true } });
      tenantId = branch?.tenantId || null;
    }
    if (!tenantId) {
      // Default to Flagship Salon for system/seed events
      const defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'flagship-salon' } });
      tenantId = defaultTenant?.id;
    }
    await prisma.auditEvent.update({
      where: { id: a.id },
      data: { tenantId }
    });
  }

  console.log('✅ Backfill complete.');
  process.exit(0);
}

backfillNulls().catch(console.error);

