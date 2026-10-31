import { DemoCredential } from '../types/auth';

export const BRAND_COLORS = {
  primary: '#9D2558',
  primaryHover: '#851C47',
  darkText: '#23151D',
  pageBg: '#FAF8F9',
  white: '#FFFFFF',
  border: '#E2E8F0',
  borderMuted: '#FDF2F5',
};

export const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    portal: 'SUPER_ADMIN',
    label: 'Super Administrator',
    roleName: 'Global Executive Admin',
    email: 'superadmin@isysware.com',
    password: 'admin123',
    branchName: 'All Branches (Consolidated View)',
    description: 'Consolidated oversight, branch management, and full system audit.',
    user: {
      id: 'usr-super-01',
      name: 'Super Administrator',
      email: 'superadmin@isysware.com',
      role: 'SUPER_ADMIN',
      branchId: 'ALL',
      branchName: 'All Branches',
      title: 'Global Operations Director',
      phone: '+92 (42) 3578-9100',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  },
  {
    portal: 'ADMIN',
    label: 'Meerub Salon Admin',
    roleName: 'Meerub Salon Branch Manager',
    email: 'admin@meerubsalon.com',
    password: 'admin123',
    branchName: 'Meerub Salon (Karachi)',
    description: 'Branch administrator for Meerub Salon: appointments, billing, staff and finances.',
    user: {
      id: 'usr-admin-meerub',
      name: 'Meerub Admin',
      email: 'admin@meerubsalon.com',
      role: 'ADMIN',
      branchId: 'b0000000-0000-0000-0000-000000000001',
      branchName: 'Meerub Salon',
      title: 'Branch Manager',
      phone: '+92 (300) 000-0002',
      isActive: true,
      createdAt: '2026-10-01T00:00:00Z',
    },
  },
];
