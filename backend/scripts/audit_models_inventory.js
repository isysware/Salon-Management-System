import prisma from '../src/config/prisma.js';

async function main() {
  const models = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
  
  // Get all tenants in DB
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
  console.log('--- REGISTERED TENANTS IN DB ---');
  console.table(tenants);

  const results = [];

  for (const modelName of models) {
    const delegate = prisma[modelName];
    if (!delegate || typeof delegate.count !== 'function') continue;

    try {
      const total = await delegate.count();
      
      // Check if model has tenantId field by attempting query with where: { tenantId: null }
      let hasTenantId = false;
      let nullTenantCount = 0;
      let tenantCounts = {};

      try {
        nullTenantCount = await delegate.count({ where: { tenantId: null } });
        hasTenantId = true;
        for (const t of tenants) {
          tenantCounts[t.slug] = await delegate.count({ where: { tenantId: t.id } });
        }
      } catch (err) {
        // Model does not have tenantId column
        hasTenantId = false;
      }

      results.push({
        model: modelName,
        total,
        hasTenantId,
        nullTenantCount: hasTenantId ? nullTenantCount : 'N/A',
        flagship: hasTenantId ? (tenantCounts['flagship-salon'] || 0) : '-',
        royalElegance: hasTenantId ? (tenantCounts['royal-elegance'] || 0) : '-',
      });
    } catch (err) {
      results.push({
        model: modelName,
        error: err.message
      });
    }
  }

  console.log('\n--- PRISMA MODELS RECONCILIATION & TENANT DISTRIBUTION ---');
  console.table(results);

  // Group summary
  const withTenantCol = results.filter(r => r.hasTenantId);
  const withoutTenantCol = results.filter(r => !r.hasTenantId && !r.error);
  const withNulls = results.filter(r => r.hasTenantId && r.nullTenantCount > 0);
  const totalRowsInDb = results.reduce((acc, r) => acc + (typeof r.total === 'number' ? r.total : 0), 0);

  console.log('\n--- AGGREGATE SUMMARY ---');
  console.log(`Total Models: ${results.length}`);
  console.log(`Models with tenantId column: ${withTenantCol.length}`);
  console.log(`Models without tenantId column: ${withoutTenantCol.length}`);
  console.log(`Models with tenantId IS NULL rows: ${withNulls.length}`);
  console.log(`Total rows across all tables: ${totalRowsInDb}`);

  if (withNulls.length > 0) {
    console.log('\n⚠️ TABLES WITH NULL tenantId ROWS:');
    console.table(withNulls);
  } else {
    console.log('\n✅ ZERO NULL tenantId rows in all tables that have tenantId column!');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

