import React, { useState, useEffect } from 'react';
import {
  Building2,
  DollarSign,
  Users,
  ShieldCheck,
  PlusCircle,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  Layers,
  LogOut,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock,
  Mail,
  Phone,
  MapPin,
  Check,
  X
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/v1';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('saas_platform_token'));
  const [activeTab, setActiveTab] = useState<'overview' | 'salons' | 'plans' | 'payments'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auth form
  const [email, setEmail] = useState('superadmin@isysware.com');
  const [password, setPassword] = useState('admin123');

  // Platform Data
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState<any>(null);

  // Onboarding Form State
  const [newSalon, setNewSalon] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    contactPhone: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: 'Password123!',
    planId: '',
    billingCycle: 'MONTHLY',
    branchName: 'Main Branch',
    branchCity: 'Karachi',
    branchAddress: 'Main Commercial Avenue',
    branchPhone: '+92 300 0000000',
  });

  // Custom Plan Form State
  const [newPlan, setNewPlan] = useState({
    code: '',
    name: '',
    description: '',
    monthlyPrice: 15000,
    annualPrice: 150000,
    maxBranches: 2,
    maxStaff: 15,
    maxDevices: 2,
    hasBiometrics: true,
    hasPayroll: true,
    hasCustomSms: false,
    hasInventory: true,
    hasBookings: true,
    allowedModules: ['pos', 'services', 'clients', 'appointments', 'inventory', 'expenses', 'reports'],
  });

  const availableModulesList = [
    { key: 'pos', label: 'POS & Billing' },
    { key: 'services', label: 'Catalogue & Packages' },
    { key: 'clients', label: 'Client CRM' },
    { key: 'appointments', label: 'Appointments' },
    { key: 'bookings', label: 'Event Bookings' },
    { key: 'inventory', label: 'Inventory & Stock' },
    { key: 'expenses', label: 'Expenses Ledger' },
    { key: 'payroll', label: 'Staff & Payroll' },
    { key: 'reports', label: 'Financial Reports' },
    { key: 'devices', label: 'Hardware & Biometrics' },
  ];

  // Auto-fetch data when token exists
  useEffect(() => {
    if (token) {
      fetchPlatformData();
    }
  }, [token]);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password, portal: 'SUPER_ADMIN' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed. Please check credentials.');
      }
      const authToken = data.data?.token || data.data?.accessToken;
      localStorage.setItem('saas_platform_token', authToken);
      setToken(authToken);
      showNotification('Welcome back, Super Admin!');
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('saas_platform_token');
    setToken(null);
  };

  const fetchPlatformData = async () => {
    if (!token) return;
    setLoading(true);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    try {
      const [statsRes, tenantsRes, plansRes, paymentsRes] = await Promise.all([
        fetch(`${API_BASE}/platform/stats`, { headers }),
        fetch(`${API_BASE}/platform/tenants`, { headers }),
        fetch(`${API_BASE}/platform/plans`, { headers }),
        fetch(`${API_BASE}/platform/payments/pending`, { headers }),
      ]);

      if (statsRes.status === 401 || tenantsRes.status === 401) {
        handleLogout();
        return;
      }

      const [statsJson, tenantsJson, plansJson, paymentsJson] = await Promise.all([
        statsRes.json(),
        tenantsRes.json(),
        plansRes.json(),
        paymentsRes.json(),
      ]);

      setStats(statsJson.data);
      setTenants(tenantsJson.data || []);
      setPlans(plansJson.data || []);
      setPendingPayments(paymentsJson.data || []);

      if (plansJson.data?.length > 0 && !newSalon.planId) {
        setNewSalon((prev) => ({ ...prev, planId: plansJson.data[0].id }));
      }
    } catch (err: any) {
      showNotification('Failed to sync platform data: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`${API_BASE}/platform/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Status update failed');
      showNotification(`Salon status changed to ${nextStatus}`);
      fetchPlatformData();
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  const handleOnboardSalon = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/platform/tenants`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSalon),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Provisioning failed');

      setProvisionSuccess(data.data);
      showNotification(`Salon '${newSalon.name}' provisioned successfully!`);
      fetchPlatformData();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/platform/plans`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPlan),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create plan');

      showNotification(`Plan '${newPlan.name}' created with custom modules!`);
      setShowPlanModal(false);
      fetchPlatformData();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (paymentId: string) => {
    try {
      const res = await fetch(`${API_BASE}/platform/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Payment verification failed');
      showNotification('Payment verified! Salon subscription extended successfully.');
      fetchPlatformData();
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    const reason = prompt('Please enter reason for rejection:') || 'Invalid transaction reference';
    try {
      const res = await fetch(`${API_BASE}/platform/payments/${paymentId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      if (!res.ok) throw new Error('Payment rejection failed');
      showNotification('Payment slip marked as rejected');
      fetchPlatformData();
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  // If unauthenticated, show Master Admin Login Screen
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6 justify-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">SalonOS SaaS</h1>
              <p className="text-xs text-indigo-400 font-medium">Platform Master Admin Portal</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Master Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Master Key / Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Sign In to Control Plane'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <span className="text-xs text-slate-500">
              Strict Isolation Active • Decoupled Platform Tier (Portal 1)
            </span>
          </div>
        </div>
      </div>
    );
  }

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.owner?.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight">SalonOS Platform</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium">
                Master Admin
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('salons')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'salons'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Salons ({tenants.length})
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'plans'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Plans & Modules
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'payments'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Payments
              {pendingPayments.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-xs bg-amber-500 text-slate-950 font-bold">
                  {pendingPayments.length}
                </span>
              )}
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchPlatformData}
              title="Refresh Data"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-red-400 p-2 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-950/80 border-b border-emerald-800 px-4 py-2.5 text-center text-sm text-emerald-300 font-medium flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-950/80 border-b border-red-800 px-4 py-2.5 text-center text-sm text-red-300 font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Platform Overview</h2>
                <p className="text-sm text-slate-400">Multi-tenant health metrics and revenue indicators</p>
              </div>
              <button
                onClick={() => {
                  setProvisionSuccess(null);
                  setShowOnboardModal(true);
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Onboard New Salon</span>
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Active MRR</span>
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  PKR {Number(stats?.estimatedMRR || 0).toLocaleString()}
                </div>
                <p className="text-xs text-slate-400 mt-1">Monthly Recurring Platform Revenue</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Total Salons</span>
                  <Building2 className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-white">{stats?.totalTenants || 0}</div>
                <p className="text-xs text-slate-400 mt-1">
                  {stats?.activeTenants || 0} Active • {stats?.suspendedTenants || 0} Suspended
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Branches</span>
                  <Layers className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white">{stats?.totalBranches || 0}</div>
                <p className="text-xs text-slate-400 mt-1">Operating Across All Salons</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Pending Slips</span>
                  <CreditCard className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400">{stats?.pendingPayments || 0}</div>
                <p className="text-xs text-slate-400 mt-1">Awaiting Manual Verification</p>
              </div>
            </div>

            {/* Recent Salons Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-semibold text-white">Recently Provisioned Salons</h3>
                <button
                  onClick={() => setActiveTab('salons')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-800">
                {tenants.slice(0, 5).map((t) => (
                  <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-400">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          <span>{t.name}</span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                              t.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          slug: <span className="font-mono text-slate-300">{t.slug}</span> • Owner:{' '}
                          {t.owner?.email || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-indigo-300">
                        {t.subscription?.planName || 'Standard'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t.branchCount} Branch(es) • {t.userCount} User(s)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SALONS DIRECTORY TAB */}
        {activeTab === 'salons' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Registered Salons</h2>
                <p className="text-sm text-slate-400">Total {tenants.length} salon companies in database</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search by name or slug..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={() => {
                    setProvisionSuccess(null);
                    setShowOnboardModal(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>New Salon</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-xs uppercase font-semibold tracking-wider">
                    <th className="py-3.5 px-4">Salon / Company</th>
                    <th className="py-3.5 px-4">Owner Profile</th>
                    <th className="py-3.5 px-4">Plan & Quotas</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white">{t.name}</div>
                        <div className="text-xs text-slate-400 font-mono">/{t.slug}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{t.contactPhone}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-200">{t.owner?.name || 'Owner Profile'}</div>
                        <div className="text-xs text-indigo-400">{t.owner?.email}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-emerald-400">
                          {t.subscription?.planName || 'Growth Plan'}
                        </div>
                        <div className="text-xs text-slate-400">
                          Branches: {t.branchCount} / {t.subscription?.maxBranches ?? '∞'} • Staff:{' '}
                          {t.userCount} / {t.subscription?.maxStaff ?? '∞'}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {t.status === 'ACTIVE' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {t.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleToggleTenantStatus(t.id, t.status)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                            t.status === 'ACTIVE'
                              ? 'bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800'
                              : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {t.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PLANS & DYNAMIC MODULES TAB */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Dynamic Plans & Module Access</h2>
                <p className="text-sm text-slate-400">
                  Control quotas and module entitlements across all subscription tiers
                </p>
              </div>
              <button
                onClick={() => setShowPlanModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Custom Plan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p) => {
                const version = p.versions?.[0] || {};
                const allowedMods = version.allowedModules || [];

                return (
                  <div
                    key={p.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {p.code}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">{p.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{p.description}</p>

                      <div className="my-5 pb-5 border-b border-slate-800">
                        <span className="text-3xl font-extrabold text-white">
                          PKR {Number(version.monthlyPrice || 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400 ml-1.5">/ month</span>
                        <div className="text-xs text-indigo-400 mt-1">
                          Annual: PKR {Number(version.annualPrice || 0).toLocaleString()} / year
                        </div>
                      </div>

                      {/* Quotas */}
                      <div className="space-y-2 mb-5">
                        <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                          Resource Quotas
                        </div>
                        <div className="text-xs flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-300">Max Branches</span>
                          <span className="font-semibold text-white">{version.maxBranches}</span>
                        </div>
                        <div className="text-xs flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-300">Max Staff Members</span>
                          <span className="font-semibold text-white">{version.maxStaff}</span>
                        </div>
                        <div className="text-xs flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-300">Max POS Devices</span>
                          <span className="font-semibold text-white">{version.maxDevices}</span>
                        </div>
                      </div>

                      {/* Module Entitlements */}
                      <div className="space-y-2">
                        <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                          Enabled Modules ({allowedMods.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {availableModulesList.map((m) => {
                            const isAllowed = allowedMods.includes(m.key);
                            return (
                              <span
                                key={m.key}
                                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 ${
                                  isAllowed
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : 'bg-slate-950 text-slate-600 line-through opacity-50'
                                }`}
                              >
                                {isAllowed ? <Check className="w-3 h-3 text-indigo-400" /> : <X className="w-3 h-3" />}
                                {m.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PAYMENTS VERIFICATION TAB */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Manual Slip Verifications</h2>
              <p className="text-sm text-slate-400">
                Verify bank deposit and mobile payment slips uploaded by salon owners
              </p>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white">All Clear!</h3>
                <p className="text-sm text-slate-400 mt-1">No pending subscription slips awaiting verification.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPayments.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-white">{p.tenant?.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                          PENDING VERIFICATION
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Contact: {p.tenant?.contactEmail} • {p.tenant?.contactPhone}
                      </div>
                      <div className="text-sm text-slate-200 mt-3 flex flex-wrap gap-4 font-mono">
                        <div>
                          Amount: <span className="text-emerald-400 font-bold">PKR {Number(p.amount).toLocaleString()}</span>
                        </div>
                        <div>
                          Method: <span className="text-indigo-300">{p.paymentMethod}</span>
                        </div>
                        <div>
                          Tx Ref: <span className="text-amber-300">{p.transactionRef}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleVerifyPayment(p.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition"
                      >
                        <Check className="w-4 h-4" />
                        <span>Verify & Extend (+1 Month)</span>
                      </button>
                      <button
                        onClick={() => handleRejectPayment(p.id)}
                        className="px-4 py-2 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ONBOARD SALON MODAL */}
      {showOnboardModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-6 h-6 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Onboard New Salon Company</h3>
              </div>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {provisionSuccess ? (
              <div className="space-y-5 text-center py-4">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-bold text-white">Salon Successfully Provisioned!</h4>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-left space-y-2 text-sm font-mono">
                  <div>
                    <span className="text-slate-500">Salon Name:</span>{' '}
                    <span className="text-white font-bold">{provisionSuccess.tenant?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Salon Slug:</span>{' '}
                    <span className="text-indigo-400">{provisionSuccess.tenant?.slug}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">First Branch:</span>{' '}
                    <span className="text-slate-200">{provisionSuccess.branch?.name} ({provisionSuccess.branch?.code})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Owner Login Email:</span>{' '}
                    <span className="text-emerald-400 font-bold">{provisionSuccess.owner?.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Initial Password:</span>{' '}
                    <span className="text-amber-400 font-bold">{provisionSuccess.owner?.plainPassword}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Salon App URL:</span>{' '}
                    <span className="text-blue-400">http://localhost:3001</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowOnboardModal(false)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleOnboardSalon} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                      Salon Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Elegance Hair Lounge"
                      value={newSalon.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const slug = name
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)/g, '');
                        setNewSalon((prev) => ({ ...prev, name, slug }));
                      }}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                      Slug (Subdomain Identifier)
                    </label>
                    <input
                      type="text"
                      placeholder="elegance-hair"
                      value={newSalon.slug}
                      onChange={(e) => setNewSalon((prev) => ({ ...prev, slug: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      placeholder="info@elegance.com"
                      value={newSalon.contactEmail}
                      onChange={(e) => setNewSalon((prev) => ({ ...prev, contactEmail: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+92 300 1234567"
                      value={newSalon.contactPhone}
                      onChange={(e) => setNewSalon((prev) => ({ ...prev, contactPhone: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <h4 className="text-xs uppercase font-bold text-indigo-400 mb-3 tracking-wider">
                    Owner Account Credentials
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Owner Full Name</label>
                      <input
                        type="text"
                        placeholder="Owner Name"
                        value={newSalon.ownerName}
                        onChange={(e) => setNewSalon((prev) => ({ ...prev, ownerName: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Owner Email (Login)</label>
                      <input
                        type="email"
                        placeholder="owner@salon.com"
                        value={newSalon.ownerEmail}
                        onChange={(e) => setNewSalon((prev) => ({ ...prev, ownerEmail: e.target.value }))}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Initial Password</label>
                      <input
                        type="text"
                        value={newSalon.ownerPassword}
                        onChange={(e) => setNewSalon((prev) => ({ ...prev, ownerPassword: e.target.value }))}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <h4 className="text-xs uppercase font-bold text-indigo-400 mb-3 tracking-wider">
                    Plan & Subscription Assignment
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Assign Plan</label>
                      <select
                        value={newSalon.planId}
                        onChange={(e) => setNewSalon((prev) => ({ ...prev, planId: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.code}) — PKR {Number(p.versions?.[0]?.monthlyPrice || 0).toLocaleString()}/mo
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Billing Cycle</label>
                      <select
                        value={newSalon.billingCycle}
                        onChange={(e) => setNewSalon((prev) => ({ ...prev, billingCycle: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      >
                        <option value="MONTHLY">Monthly Renewal</option>
                        <option value="ANNUAL">Annual Renewal (12 Months)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <h4 className="text-xs uppercase font-bold text-indigo-400 mb-3 tracking-wider">
                    Primary Branch Setup
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Branch Name</label>
                      <input
                        type="text"
                        value={newSalon.branchName}
                        onChange={(e) => setNewSalon((prev) => ({ ...prev, branchName: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">City</label>
                      <input
                        type="text"
                        value={newSalon.branchCity}
                        onChange={(e) => setNewSalon((prev) => ({ ...prev, branchCity: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Branch Phone</label>
                      <input
                        type="text"
                        value={newSalon.branchPhone}
                        onChange={(e) => setNewSalon((prev) => ({ ...prev, branchPhone: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50 transition"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Provision Salon'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CREATE CUSTOM PLAN MODAL */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Create Custom Plan with Dynamic Modules</h3>
              </div>
              <button
                onClick={() => setShowPlanModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Plan Code
                  </label>
                  <input
                    type="text"
                    placeholder="VIP_CUSTOM"
                    value={newPlan.code}
                    onChange={(e) => setNewPlan((prev) => ({ ...prev, code: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Plan Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="VIP Custom Salon Plan"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Monthly Price (PKR)
                  </label>
                  <input
                    type="number"
                    value={newPlan.monthlyPrice}
                    onChange={(e) => setNewPlan((prev) => ({ ...prev, monthlyPrice: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Annual Price (PKR)
                  </label>
                  <input
                    type="number"
                    value={newPlan.annualPrice}
                    onChange={(e) => setNewPlan((prev) => ({ ...prev, annualPrice: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Branches</label>
                  <input
                    type="number"
                    value={newPlan.maxBranches}
                    onChange={(e) => setNewPlan((prev) => ({ ...prev, maxBranches: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Staff</label>
                  <input
                    type="number"
                    value={newPlan.maxStaff}
                    onChange={(e) => setNewPlan((prev) => ({ ...prev, maxStaff: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Devices</label>
                  <input
                    type="number"
                    value={newPlan.maxDevices}
                    onChange={(e) => setNewPlan((prev) => ({ ...prev, maxDevices: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              {/* Dynamic Modules Checkboxes */}
              <div className="pt-3 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Toggle Entitled Modules for This Plan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableModulesList.map((m) => {
                    const isChecked = newPlan.allowedModules.includes(m.key);
                    return (
                      <button
                        type="button"
                        key={m.key}
                        onClick={() => {
                          setNewPlan((prev) => {
                            const next = isChecked
                              ? prev.allowedModules.filter((x) => x !== m.key)
                              : [...prev.allowedModules, m.key];
                            return { ...prev, allowedModules: next };
                          });
                        }}
                        className={`p-2.5 rounded-xl text-xs font-medium border flex items-center justify-between transition ${
                          isChecked
                            ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        <span>{m.label}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50 transition"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

