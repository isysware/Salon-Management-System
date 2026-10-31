import prisma from '../src/config/prisma.js';

async function testClientCreate() {
  console.log('🧪 Testing client creation via API...');

  // 1. Login as Tenant B Owner (Ayesha)
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'ayesha.owner@royalelegance.com',
      password: 'Password123!',
      portal: 'ADMIN'
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token;

  // 2. Create client as Ayesha
  const clientRes = await fetch('http://localhost:5000/api/v1/clients', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Customer Ayesha',
      phone: '03009998877',
      email: 'customer@test.com'
    })
  });

  const clientData = await clientRes.json();
  console.log('Client create response:', clientRes.status, clientData);

  if (clientRes.ok) {
    const createdId = clientData.data?.id;
    const dbRecord = await prisma.client.findUnique({ where: { id: createdId } });
    console.log('Database row for newly created client:', {
      id: dbRecord.id,
      name: dbRecord.name,
      branchId: dbRecord.branchId,
      tenantId: dbRecord.tenantId // Is this NULL?
    });
    if (dbRecord.tenantId === null) {
      console.log('🚨 VULNERABILITY CONFIRMED: Newly created Client has tenantId = NULL because client.service.js does not populate tenantId!');
    } else {
      console.log('tenantId is populated:', dbRecord.tenantId);
    }
  }

  process.exit(0);
}

testClientCreate().catch(console.error);
