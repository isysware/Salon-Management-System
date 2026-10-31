import prisma from '../src/config/prisma.js';

async function main() {
  const rlsPolicies = await prisma.$queryRaw`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies;
  `;
  console.log('--- PostgreSQL RLS Policies in DB ---');
  console.log('Count:', rlsPolicies.length);
  console.table(rlsPolicies);

  const rlsTables = await prisma.$queryRaw`
    SELECT relname, relrowsecurity, relforcerowsecurity 
    FROM pg_class 
    WHERE relrowsecurity = true;
  `;
  console.log('\n--- Tables with Row Level Security Enabled ---');
  console.log('Count:', rlsTables.length);
  console.table(rlsTables);

  const dbUser = await prisma.$queryRaw`
    SELECT current_user, session_user, usesuper FROM pg_user WHERE usename = current_user;
  `;
  console.log('\n--- Current Database Connection Role ---');
  console.table(dbUser);

  process.exit(0);
}

main().catch(console.error);

