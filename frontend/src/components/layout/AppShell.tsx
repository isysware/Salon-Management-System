import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileDrawer } from './MobileDrawer';
import { useRouter } from '../../context/RouterContext';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const { pathname } = useRouter();

  // Generate dynamic breadcrumbs based on pathname
  const generateBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) {
      return [{ label: 'Workspace' }, { label: 'Dashboard' }];
    }

    const breadcrumbs = [];
    const firstPart = parts[0];

    const categoryMap: Record<string, string> = {
      dashboard: 'Workspace',
      pos: 'Workspace',
      operations: 'Operations',
      accounts: 'Accounts & Finance',
      reports: 'Reporting & Analytics',
      admin: 'Administration',
      'my-performance': 'My Workspace',
      'my-attendance': 'My Workspace',
      'my-reports': 'My Workspace',
    };

    if (categoryMap[firstPart]) {
      breadcrumbs.push({ label: categoryMap[firstPart] });
    }

    // Capitalize and format leaf title
    const leaf = parts[parts.length - 1];
    const specialTitles: Record<string, string> = {
      generate: 'Generate Salary',
      manage: 'Manage Salaries',
      allowances: 'Allowances & Adjustments',
      loans: 'Loan Management',
      commission: 'Staff Commission',
      payroll: 'Generate Salary',
      'staff-loans': 'Loan Management',
    };
    const leafTitle = specialTitles[leaf] || leaf
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    breadcrumbs.push({ label: leafTitle });
    return breadcrumbs;
  };

  return (
    <div className={`min-h-screen flex bg-[#FAF8F9] text-[#18191B] max-w-full overflow-x-hidden relative ${pathname === '/pos' ? 'lg:h-screen lg:overflow-hidden' : ''}`}>
      {/* ── AMBIENT LUXURY BLUR GLOW LIGHTS (VISIBLE UNDER FROSTED SIDEBAR, HEADER & CARDS) ── */}
      <div className="fixed -top-20 -left-20 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#FCE4EC]/65 via-[#F8BBD0]/35 to-transparent blur-[140px] pointer-events-none -z-0" />
      <div className="fixed top-[20%] -right-20 w-[650px] h-[650px] rounded-full bg-gradient-to-bl from-[#FFF0F5]/80 via-[#F8D2DC]/45 to-transparent blur-[150px] pointer-events-none -z-0" />
      <div className="fixed top-[55%] left-[20%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-[#FCE8EC]/50 via-[#F4DDE5]/40 to-transparent blur-[130px] pointer-events-none -z-0" />
      <div className="fixed -bottom-24 right-[30%] w-[700px] h-[500px] rounded-full bg-gradient-to-tr from-[#FAF0F3]/75 via-[#FCE4EC]/35 to-transparent blur-[160px] pointer-events-none -z-0" />

      {/* Desktop Sidebar */}
      <div className={`hidden lg:block shrink-0 ${isSidebarCollapsed ? 'w-20' : 'w-72'} transition-all duration-200 relative z-20`}>
        <div className={`fixed inset-y-0 left-0 z-20 ${isSidebarCollapsed ? 'w-20' : 'w-72'} transition-all duration-200`}>
          <Sidebar isCollapsed={isSidebarCollapsed} />
        </div>
      </div>

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Viewport */}
      <div className={`flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden ${pathname === '/pos' ? 'h-screen max-h-screen overflow-hidden' : ''}`}>
        <Header
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
          breadcrumbs={generateBreadcrumbs()}
        />

        <main className={`flex-1 w-full min-w-0 max-w-full bg-transparent relative ${pathname === '/pos' ? 'p-2 sm:p-2.5 min-h-0 flex flex-col overflow-hidden' : 'px-3 sm:px-5 lg:px-6 py-3 sm:py-5 overflow-x-hidden'}`}>
          {children}
        </main>
      </div>
    </div>
  );
};
