import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { NAVIGATION_GROUPS } from '../../config/navigation';
import { getDefaultRouteForRole } from '../../lib/permissions';
import { NavIcon } from './NavIcon';
import { Scissors, ChevronDown, Sparkles, LogOut } from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  className?: string;
  onNavigate?: () => void;
}

const isRouteMatching = (targetHref: string, currentPath: string): boolean => {
  const baseTarget = targetHref.split('?')[0];
  if (currentPath === baseTarget) return true;
  if (baseTarget !== '/' && baseTarget !== '/dashboard' && currentPath.startsWith(baseTarget)) return true;
  if (baseTarget === '/operations/inventory' && (currentPath === '/inventory' || currentPath === '/operations/inventory-suppliers')) return true;
  if (baseTarget === '/operations/stock-in' && (currentPath === '/operations/purchases' || currentPath === '/purchases')) return true;
  if (baseTarget === '/operations/suppliers' && (currentPath === '/suppliers' || currentPath === '/operations/vendors')) return true;
  if (baseTarget === '/operations/supplier-ledger' && currentPath === '/operations/supplier-khata') return true;
  if (baseTarget === '/operations/stock-adjustments' && currentPath === '/operations/adjustments') return true;
  if (baseTarget === '/reports/sales-invoices' && currentPath === '/invoices/sales') return true;
  if (baseTarget === '/reports/unpaid-invoices' && currentPath === '/invoices/unpaid') return true;
  if (baseTarget === '/accounts/expenses' && currentPath === '/expenses') return true;
  if (baseTarget === '/reports/detailed-expenses' && currentPath.startsWith('/reports/detailed-expenses')) return true;
  if (baseTarget === '/reports/detailed-income' && (currentPath === '/reports/detailed-income' || currentPath === '/reports/income-drilldown')) return true;
  if (baseTarget === '/reports/debit-credit' && (currentPath === '/reports/debit-credit-statement' || currentPath === '/reports/cash-drawer' || currentPath === '/reports/payment-accounts')) return true;
  if (baseTarget === '/reports/tax' && currentPath === '/reports/tax-management') return true;
  if (baseTarget === '/reports/attendance' && (currentPath === '/reports/attendance-overtime' || currentPath === '/reports/overtime')) return true;
  if (baseTarget === '/reports/operating-profit' && (currentPath === '/reports/cogs' || currentPath === '/reports/cogs-report')) return true;
  if (baseTarget === '/accounts/account-settlement' && currentPath === '/reports/settlement-history') return true;
  if (baseTarget === '/admin/branch-settings' && (currentPath === '/admin/branch-settings' || currentPath === '/admin/salon-profile')) return true;
  if (baseTarget === '/admin/devices' && currentPath === '/admin/device-settings') return true;
  if (baseTarget === '/admin/data-reset' && currentPath === '/admin/reset-data') return true;
  if (baseTarget === '/admin/users' && currentPath === '/admin/users-access') return true;
  return false;
};

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  className = '',
  onNavigate,
}) => {
  const { user, allBranches, activeBranchId, logout } = useAuth();
  const { pathname, navigate } = useRouter();
  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({});

  const branchList = Array.isArray(allBranches) ? allBranches : [];
  const currentBranch =
    branchList.find((b) => b.id === (user?.role === 'SUPER_ADMIN' && activeBranchId !== 'ALL' ? activeBranchId : user?.branchId)) ||
    branchList[0];

  const brandName = currentBranch?.name || user?.branchName || 'SalonOS';
  const logoUrl = currentBranch?.logoUrl;

  const toggleSubMenu = (itemId: string, defaultOpen: boolean) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [itemId]: prev[itemId] !== undefined ? !prev[itemId] : !defaultOpen,
    }));
  };

  if (!user) return null;

  // Filter groups and children that the current user has permission to see
  const visibleGroups = NAVIGATION_GROUPS.map((group) => {
    if (!group.allowedRoles.includes(user.role)) return null;
    const visibleItems = group.items
      .filter((item) => item.allowedRoles.includes(user.role))
      .map((item) => ({
        ...item,
        children: item.children
          ? item.children.filter((child) => child.allowedRoles.includes(user.role))
          : undefined,
      }))
      .filter((item) => !item.children || item.children.length > 0);
    if (visibleItems.length === 0) return null;
    return { ...group, items: visibleItems };
  }).filter(Boolean);

  const handleItemClick = (href: string) => {
    navigate(href);
    if (onNavigate) {
      onNavigate();
    }
  };

  {/* ── 1. COLLAPSED VIEW: DOCKED FLOATING PILL DOCK (MATCHING IMAGE 1) ── */}
  if (isCollapsed) {
    const allNavItems = visibleGroups.flatMap((group) => group?.items || []);

    return (
      <aside
        className={`h-full max-h-screen bg-white/70 backdrop-blur-2xl border-0 flex flex-col justify-between py-3.5 px-2 select-none overflow-hidden text-slate-800 relative z-20 w-20 transition-all duration-200 shadow-[4px_0_24px_rgba(35,21,29,0.02)] ${className}`}
      >
        {/* Top Floating Logo Pill */}
        <div
          onClick={() => handleItemClick(user ? getDefaultRouteForRole(user.role) : '/')}
          title={brandName}
          className="w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-xl shadow-sm flex items-center justify-center p-2 mx-auto cursor-pointer hover:scale-105 transition-all duration-200 shrink-0"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#C43872] via-[#B82E69] to-[#9D2558] flex items-center justify-center text-white shadow-2xs">
              <Scissors className="w-4 h-4 -rotate-45" />
            </div>
          )}
        </div>

        {/* Middle Main Navigation Floating Dock Pill */}
        <div className="w-[54px] mx-auto my-auto rounded-3xl bg-white/90 backdrop-blur-xl shadow-[0_8px_25px_rgba(35,21,29,0.035)] py-2.5 px-1.5 flex flex-col items-center gap-1.5 max-h-[calc(100vh-160px)] overflow-y-auto scrollbar-none">
          {allNavItems.map((item) => {
            const hasChildren = Boolean(item.children && item.children.length > 0);
            const isChildActive = hasChildren && item.children!.some((c) => isRouteMatching(c.href, pathname));
            const isActive = (!hasChildren && isRouteMatching(item.href, pathname)) || (hasChildren && isChildActive);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.href)}
                title={item.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative shrink-0 ${
                  isActive
                    ? 'bg-[#B82E69] text-white shadow-[0_3px_10px_rgba(184,46,105,0.35)] font-bold scale-105'
                    : 'text-[#78616C] hover:text-[#18191B] hover:bg-[#FDF2F5]'
                }`}
              >
                <NavIcon name={item.iconName} className="w-4 h-4" />
                {item.badge && !isActive && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#B82E69]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Floating Utility Dock */}
        <div className="w-[54px] mx-auto rounded-2xl bg-white/90 backdrop-blur-xl shadow-sm py-2 px-1 flex flex-col items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleItemClick(user ? getDefaultRouteForRole(user.role) : '/')}
            title="System Dashboard"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#78616C] hover:text-[#18191B] hover:bg-[#FDF2F5] transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (logout) {
                await logout();
                navigate('/');
              }
            }}
            title="Log Out"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#78616C] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  {/* ── 2. EXPANDED VIEW: CLEAN SAAS SIDEBAR WITH LIGHTENED MAROON (IMAGE 2) ── */}
  return (
    <aside
      className={`h-full max-h-screen bg-white/75 backdrop-blur-2xl border-0 flex flex-col transition-all duration-200 select-none overflow-hidden text-slate-800 shadow-[4px_0_28px_rgba(35,21,29,0.025)] relative z-20 w-72 ${className}`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-0 shrink-0 bg-transparent relative z-10">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => handleItemClick(user ? getDefaultRouteForRole(user.role) : '/')}>
          {logoUrl ? (
            <div className="w-9.5 h-9.5 rounded-xl bg-white shadow-2xs flex items-center justify-center p-1 shrink-0 overflow-hidden">
              <img src={logoUrl} alt={brandName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-9.5 h-9.5 rounded-xl bg-gradient-to-br from-[#C43872] via-[#B82E69] to-[#9D2558] flex items-center justify-center text-white shrink-0 shadow-xs">
              <Scissors className="w-5 h-5 -rotate-45" />
            </div>
          )}
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-[#18191B] tracking-tight truncate max-w-[190px]" title={brandName}>
                {brandName}
              </span>
            </div>
            <div className="mt-0.5">
              <p className="text-[11px] text-[#78616C] font-medium truncate">
                {currentBranch?.city ? `${currentBranch.city} Branch` : 'Management System'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 space-y-4 sidebar-scroller bg-transparent relative z-10">
        {visibleGroups.map((group) => {
          if (!group) return null;
          return (
            <div key={group.id} className="space-y-1">
              <div className="px-3 text-[10px] font-extrabold text-[#A38D98] uppercase tracking-[0.14em] mb-1.5 flex items-center gap-2">
                <span>{group.label}</span>
                <span className="h-px flex-1 bg-[#F1DEE3]/40" />
              </div>
              {group.items.map((item) => {
                const hasChildren = Boolean(item.children && item.children.length > 0);
                const isChildActive = hasChildren && item.children!.some((c) => isRouteMatching(c.href, pathname));
                const isExpanded = expandedMenus[item.id] !== undefined
                  ? expandedMenus[item.id]
                  : isChildActive;
                const isActive = (!hasChildren && isRouteMatching(item.href, pathname)) || (hasChildren && isChildActive);

                return (
                  <div key={item.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (hasChildren) {
                          toggleSubMenu(item.id, isChildActive);
                        } else {
                          handleItemClick(item.href);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer group text-left border-0 ${
                        isActive && !hasChildren
                          ? 'bg-[#B82E69] text-white font-bold shadow-[0_2px_8px_rgba(184,46,105,0.22)]'
                          : isActive && hasChildren
                          ? 'bg-[#FDF2F5] text-[#B82E69] font-bold shadow-2xs'
                          : 'text-[#55424E] hover:text-[#18191B] hover:bg-[#FAF8F9]'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg shrink-0 transition-all duration-150 ${
                          isActive && !hasChildren
                            ? 'bg-white/20 text-white shadow-2xs'
                            : isActive && hasChildren
                            ? 'bg-[#B82E69] text-white shadow-2xs'
                            : 'text-[#8F7986] group-hover:text-[#B82E69] group-hover:bg-[#FDF2F5]'
                        }`}
                      >
                        <NavIcon name={item.iconName} className="w-4 h-4" />
                      </div>

                      <div className="flex-1 flex items-center justify-between overflow-hidden">
                        <span className={`truncate text-[13px] ${
                          isActive && !hasChildren
                            ? 'font-bold text-white'
                            : isActive && hasChildren
                            ? 'font-bold text-[#B82E69]'
                            : 'font-semibold text-[#55424E] group-hover:text-[#18191B]'
                        }`}>
                          {item.label}
                        </span>
                        {hasChildren ? (
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 shrink-0 ${
                              isActive ? 'text-[#B82E69]' : 'text-[#A38D98] group-hover:text-[#18191B]'
                            } ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        ) : item.badge ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                            isActive
                              ? 'bg-white/25 text-white'
                              : 'bg-[#FDF2F5] text-[#B82E69]'
                          }`}>
                            {item.badge}
                          </span>
                        ) : null}
                      </div>
                    </button>

                    {/* Submenu Accordion Dropdown */}
                    {hasChildren && isExpanded && (
                      <div className="ml-6 pl-3 border-l-2 border-[#B82E69]/25 space-y-1 py-1 my-1">
                        {item.children!.map((child) => {
                          const isCurrent = isRouteMatching(child.href, pathname);
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => handleItemClick(child.href)}
                              className={`w-full text-left py-1.5 px-3 rounded-lg text-[12.5px] transition-all cursor-pointer block truncate border-0 ${
                                isCurrent
                                  ? 'text-[#B82E69] font-bold bg-[#FDF2F5] shadow-2xs'
                                  : 'text-[#78616C] hover:text-[#18191B] font-medium hover:bg-[#FAF8F9]'
                              }`}
                            >
                              {child.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
