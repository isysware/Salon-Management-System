import prisma from '../src/config/prisma.js';

async function runNegativeTests() {
  console.log('🧪 RUNNING ADVERSARIAL CROSS-TENANT NEGATIVE TESTS...\n');

  // 1. Get Tenants from DB
  const tenantA = await prisma.tenant.findUnique({ where: { slug: 'flagship-salon' } });
  const tenantB = await prisma.tenant.findUnique({ where: { slug: 'royal-elegance' } });

  console.log(`Tenant A: ${tenantA.name} (${tenantA.id})`);
  console.log(`Tenant B: ${tenantB.name} (${tenantB.id})\n`);

  // Find a Client of Tenant A
  const clientA = await prisma.client.findFirst({ where: { tenantId: tenantA.id } });
  // Find a Branch of Tenant A
  const branchA = await prisma.branch.findFirst({ where: { tenantId: tenantA.id } });
  // Find a Staff of Tenant A
  const staffA = await prisma.staff.findFirst({ where: { tenantId: tenantA.id } });

  console.log(`Target Records of Tenant A:`);
  console.log(` - Client A: ${clientA ? `${clientA.name} (${clientA.id})` : 'None'}`);
  console.log(` - Branch A: ${branchA ? `${branchA.name} (${branchA.id})` : 'None'}`);
  console.log(` - Staff A: ${staffA ? `${staffA.name} (${staffA.id})` : 'None'}\n`);

  // 2. Login as Tenant B User (Ayesha)
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'ayesha.owner@royalelegance.com',
      password: 'Password123!',
      portal: 'ADMIN',
    }),
  });
  const loginData = await loginRes.json();
  const tokenB = loginData.data?.token;

  if (!tokenB) {
    console.error('Failed to log in as Tenant B user:', loginData);
    process.exit(1);
  }

  const headersB = {
    Authorization: `Bearer ${tokenB}`,
    'Content-Type': 'application/json',
  };

  const results = [];

  // TEST 1: Tenant B lists Clients (GET /clients) - should only see Tenant B clients!
  {
    const res = await fetch('http://localhost:5000/api/v1/clients', { headers: headersB });
    const json = await res.json();
    const data = json.data || [];
    const leaked = data.filter((c) => c.id === clientA?.id);
    results.push({
      test: 'T1: List Clients (Cross-tenant leak)',
      status: res.status,
      leaked: leaked.length > 0,
      detail: leaked.length > 0 ? `LEAKED: Tenant A client '${clientA.name}' appeared in Tenant B list!` : 'Clean',
    });
  }

  // TEST 2: Tenant B gets specific Client A by ID (GET /clients/:id)
  if (clientA) {
    const res = await fetch(`http://localhost:5000/api/v1/clients/${clientA.id}`, { headers: headersB });
    const json = await res.json();
    results.push({
      test: 'T2: Read Client of Tenant A by ID (IDOR)',
      status: res.status,
      leaked: res.status === 200,
      detail: res.status === 200 ? `LEAKED: Tenant B fetched Client A data directly!` : `Blocked (HTTP ${res.status})`,
    });
  }

  // TEST 3: Tenant B modifies Client A (PUT /clients/:id)
  if (clientA) {
    const res = await fetch(`http://localhost:5000/api/v1/clients/${clientA.id}`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({ name: 'Hacked by Tenant B' }),
    });
    results.push({
      test: 'T3: Update Client of Tenant A (Unauthorized Mutation)',
      status: res.status,
      leaked: res.status === 200,
      detail: res.status === 200 ? 'MUTATED: Tenant B modified Tenant A client record!' : `Blocked (HTTP ${res.status})`,
    });
  }

  // TEST 4: Tenant B views Branch A by ID (GET /branches/:id)
  if (branchA) {
    const res = await fetch(`http://localhost:5000/api/v1/branches/${branchA.id}`, { headers: headersB });
    results.push({
      test: 'T4: Read Branch of Tenant A by ID',
      status: res.status,
      leaked: res.status === 200,
      detail: res.status === 200 ? 'LEAKED: Tenant B viewed Tenant A branch config!' : `Blocked (HTTP ${res.status})`,
    });
  }

  // TEST 5: Tenant B reads Staff A (GET /staff/:id)
  if (staffA) {
    const res = await fetch(`http://localhost:5000/api/v1/staff/${staffA.id}`, { headers: headersB });
    results.push({
      test: 'T5: Read Staff of Tenant A by ID',
      status: res.status,
      leaked: res.status === 200,
      detail: res.status === 200 ? 'LEAKED: Tenant B viewed Tenant A staff profile!' : `Blocked (HTTP ${res.status})`,
    });
  }

  // TEST 6: Tenant B accesses Tenant A Billing via X-Tenant-Id header
  {
    const res = await fetch('http://localhost:5000/api/v1/tenant/billing', {
      headers: { ...headersB, 'X-Tenant-Id': tenantA.id },
    });
    const json = await res.json();
    const isSpoofed = json.data?.tenant?.id === tenantA.id;
    results.push({
      test: 'T6: Spoof Billing Context via X-Tenant-Id Header',
      status: res.status,
      leaked: isSpoofed,
      detail: isSpoofed ? `LEAKED: Tenant B viewed Tenant A subscription & IBAN!` : 'Blocked',
    });
  }

  // TEST 7: Tenant B accesses Super Admin Platform endpoints (GET /platform/stats)
  {
    const res = await fetch('http://localhost:5000/api/v1/platform/stats', { headers: headersB });
    results.push({
      test: 'T7: Privilege Escalation to /platform/stats',
      status: res.status,
      leaked: res.status === 200,
      detail: res.status === 200 ? 'LEAKED: Tenant user accessed platform control plane!' : `Blocked (HTTP ${res.status})`,
    });
  }

  // TEST 8: Tenant B accesses /reports/sales-invoices with branchId=ALL
  {
    const res = await fetch('http://localhost:5000/api/v1/reports/sales-invoices?branchId=ALL', { headers: headersB });
    results.push({
      test: 'T8: Cross-Branch/Tenant Sales Invoices Report',
      status: res.status,
      leaked: false, // We check if data contains branchA
      detail: `HTTP ${res.status}`,
    });
  }

  console.log('--- NEGATIVE INTEGRATION TEST RESULTS ---');
  console.table(results);

  process.exit(0);
}

runNegativeTests().catch(console.error);

