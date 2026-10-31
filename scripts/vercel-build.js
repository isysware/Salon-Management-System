// scripts/vercel-build.js
// Production build orchestrator for unified Vercel deployment

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🚀  [SalonOS] Starting Unified Vercel Build');
console.log('====================================================');

const run = (cmd, cwd = process.cwd()) => {
  console.log(`\n▶ [RUN] ${cmd} (in ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
};

try {
  // Step 1: Ensure frontend dependencies are installed
  console.log('\n📦 Step 1/3: Installing frontend dependencies...');
  run('npm install --include=dev', path.resolve('frontend'));

  // Step 2: Generate Prisma Client for PostgreSQL
  console.log('\n⚙️  Step 2/3: Generating Prisma Client for Serverless API...');
  try {
    run('npx prisma generate --schema=prisma/schema.prisma', path.resolve('backend'));
    console.log('✅ Prisma client generated successfully.');
  } catch (prismaErr) {
    console.warn('⚠️  Prisma generate warning (continuing build):', prismaErr.message);
  }

  // Step 3: Build frontend production bundle
  console.log('\n🎨 Step 3/3: Building frontend with Vite...');
  run('npm run build', path.resolve('frontend'));

  // Verification: Ensure frontend/dist/index.html was produced
  const distHtml = path.resolve('frontend/dist/index.html');
  if (!fs.existsSync(distHtml)) {
    throw new Error('Build output verification failed: frontend/dist/index.html was not created.');
  }

  console.log('\n====================================================');
  console.log('✅  [SalonOS] Unified Vercel Build Completed Successfully!');
  console.log('====================================================\n');
} catch (error) {
  console.error('\n❌  [SalonOS] Build Failed:', error.message);
  process.exit(1);
}
