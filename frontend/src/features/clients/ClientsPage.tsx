import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Branch, Client, CustomerSource } from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { formatCurrency, formatPhoneNumber, normalizePhoneDigits } from '@/lib/formatters';
import {
  Users,
  Search,
  Plus,
  Filter,
  Eye,
  Edit,
  Archive,
  RotateCcw,
  Calendar,
  Receipt,
  Phone,
  Mail,
  Building2,
  Tag,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LuxurySelect } from '@/components/ui/LuxurySelect';
import { ClientFormModal } from './components/ClientFormModal';
import { toast } from '@/context/ToastContext';
import { ClientDetailsModal } from './components/ClientDetailsModal';
import { BookingFormModal } from '../appointments/components/BookingFormModal';

export const ClientsPage: React.FC = () => {
  const { user, allBranches } = useAuth();
  const { navigate } = useRouter();

  // Data states
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [archiveFilter, setArchiveFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [selectedClientIdForDetails, setSelectedClientIdForDetails] = useState<string | null>(null);

  // Quick booking state
  const [bookingClient, setBookingClient] = useState<Client | null>(null);

  // Load branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const loaded = await salonService.getBranches();
        setBranches(loaded);
        if (user?.role === 'SUPER_ADMIN') {
          setSelectedBranchId('ALL');
        } else if (user?.branchId) {
          setSelectedBranchId(user.branchId);
        } else if (loaded.length > 0) {
          setSelectedBranchId(loaded[0].id);
        }
      } catch (err) {
        console.error('Failed to load branches', err);
      }
    }
    loadBranches();
  }, [user]);

  // Load clients
  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const targetBranch = selectedBranchId !== 'ALL' ? selectedBranchId : 'ALL';
      const loaded = await salonService.getClients(targetBranch, user || undefined);
      setClients(loaded);
    } catch (err) {
      console.error('Failed to fetch clients', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, user]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Filter clients
  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const normDigits = q.replace(/\D/g, '');

    return clients.filter((client) => {
      // Archive filter
      if (archiveFilter === 'ACTIVE' && client.isArchived) return false;
      if (archiveFilter === 'ARCHIVED' && !client.isArchived) return false;

      // Branch filter
      if (selectedBranchId !== 'ALL' && client.branchId !== selectedBranchId) {
        return false;
      }

      // Source filter
      if (selectedSource !== 'ALL' && client.source !== selectedSource) {
        return false;
      }

      // Search query
      if (q) {
        const nameMatch = client.name.toLowerCase().includes(q);
        const normPhone = normalizePhoneDigits(client.phone);
        const phoneMatch = normDigits ? normPhone.includes(normDigits) : false;
        const emailMatch = client.email?.toLowerCase().includes(q) || false;
        if (!nameMatch && !phoneMatch && !emailMatch) return false;
      }

      return true;
    });
  }, [clients, archiveFilter, selectedBranchId, selectedSource, searchQuery]);

  // Summary KPIs
  const summaryKPIs = useMemo(() => {
    const totalCount = clients.length;
    const activeCount = clients.filter((c) => !c.isArchived).length;
    const totalDues = clients.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
    const totalVisits = clients.reduce((sum, c) => sum + (c.totalVisits || 0), 0);

    return {
      totalCount,
      activeCount,
      totalDues,
      totalVisits,
    };
  }, [clients]);

  // Archive / Restore handler
  const handleToggleArchive = async (client: Client) => {
    const nextStatus = !client.isArchived;
    const actionLabel = nextStatus ? 'archive' : 'restore';
    if (!window.confirm(`Are you sure you want to ${actionLabel} client '${client.name}'? Historical records will be preserved.`)) {
      return;
    }

    try {
      await salonService.archiveClient(client.id, nextStatus, user || undefined);
      toast.success(`Client '${client.name}' ${nextStatus ? 'archived' : 'restored'} successfully.`);
      await fetchClients();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${actionLabel} client.`);
    }
  };

  const activeBranchName = useMemo(() => {
    if (selectedBranchId === 'ALL') return 'All Branches';
    return branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId;
  }, [selectedBranchId, branches]);

  const getBranchDisplayName = useCallback(
    (branchId: string) => {
      if (!branchId || branchId === 'ALL') return 'All Branches';
      const found = branches.find((b) => b.id === branchId) || allBranches?.find((b) => b.id === branchId);
      return found?.name || 'Meerub Salon';
    },
    [branches, allBranches]
  );

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 sm:p-6 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FDF2F5] to-white border border-white/80 shadow-2xs flex items-center justify-center text-[#B82E69] shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight truncate">
                Customer Directory & History (CRM)
              </h1>
              <p className="text-xs text-[#78616C] font-medium line-clamp-1 xl:line-clamp-none mt-0.5">
                Client registry, lifetime visit frequency, service preferences & outstanding dues.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchClients}
            disabled={isLoading}
            className="text-xs gap-1.5 h-9 px-3 shrink-0 rounded-xl border border-white/80 bg-white/70 hover:bg-white text-slate-700 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setClientToEdit(null);
              setIsFormModalOpen(true);
            }}
            className="bg-[#B82E69] hover:bg-[#A02358] text-white text-xs font-semibold gap-1.5 h-9 px-4 rounded-xl shadow-xs shrink-0 whitespace-nowrap transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* KPI Cards Row - Pure White Frosted Glass */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
              <Users className="w-4 h-4" />
            </div>
            <span className="bg-[#FDF2F5] text-[#B82E69] shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Clients
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
              {summaryKPIs.totalCount}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              {summaryKPIs.activeCount} active in directory
            </span>
          </div>
        </div>

        {/* Completed Visits */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="bg-[#FAF8F9] text-[#78616C] shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Visits
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
              {summaryKPIs.totalVisits}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Cumulative salon visits
            </span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="bg-[#FDF2F5] text-[#B82E69] shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Pending
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
              {formatCurrency(summaryKPIs.totalDues)}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Uncollected client dues
            </span>
          </div>
        </div>

        {/* Scope / Branch */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="bg-emerald-50 text-emerald-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              {user?.role}
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight truncate block">
              {activeBranchName}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Operational branch context
            </span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 sm:p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Live Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search name, phone, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl border border-white/80 bg-white/80 backdrop-blur-md shadow-2xs focus:bg-white"
            />
          </div>

          {/* Branch Filter */}
          <LuxurySelect
            value={selectedBranchId}
            onValueChange={setSelectedBranchId}
            disabled={user?.role !== 'SUPER_ADMIN'}
            options={[
              ...(user?.role === 'SUPER_ADMIN' ? [{ value: 'ALL', label: 'All Branches' }] : []),
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
            placeholder="All Branches"
          />

          {/* Source Filter */}
          <LuxurySelect
            value={selectedSource}
            onValueChange={setSelectedSource}
            options={[
              { value: 'ALL', label: 'All Acquisition Sources' },
              { value: 'WALK_IN', label: 'Walk-In' },
              { value: 'INSTAGRAM', label: 'Instagram' },
              { value: 'FACEBOOK', label: 'Facebook' },
              { value: 'TIKTOK', label: 'TikTok' },
              { value: 'GOOGLE', label: 'Google Search / Maps' },
              { value: 'WORD_OF_MOUTH', label: 'Word of Mouth' },
              { value: 'REFERRAL', label: 'Client Referral' },
              { value: 'INFLUENCER', label: 'Influencer Campaign' },
              { value: 'RETURNING', label: 'Returning Regular' },
              { value: 'OTHER', label: 'Other Channel' },
            ]}
            placeholder="All Acquisition Sources"
          />

          {/* Status Filter */}
          <LuxurySelect
            value={archiveFilter}
            onValueChange={(val) => setArchiveFilter(val as any)}
            options={[
              { value: 'ACTIVE', label: 'Active Customers Only' },
              { value: 'ARCHIVED', label: 'Archived Customers' },
              { value: 'ALL', label: 'All (Active & Archived)' },
            ]}
            placeholder="Active Customers Only"
          />
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#18191B]">
            Customers ({filteredClients.length} Matches)
          </h3>
          <span className="text-xs text-[#78616C] font-medium">
            Showing records for {activeBranchName}
          </span>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-[#18191B]">No customers found</p>
            <p className="text-xs text-[#78616C] mt-1">
              Try adjusting your search criteria or register a new customer.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setClientToEdit(null);
                setIsFormModalOpen(true);
              }}
              className="mt-4 text-xs font-semibold gap-1.5 rounded-xl border border-white/80 bg-white/80 hover:bg-white text-[#B82E69]"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Customer
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="report-records min-w-[1000px] w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/60 bg-[#FAF8F9]/80 backdrop-blur-md text-[#78616C] font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 whitespace-nowrap">Customer</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Contact</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Branch</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Acquisition Source</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Visits</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Outstanding Dues</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/50">
                {filteredClients.map((client) => {
                  const hasDues = (client.outstandingBalance || 0) > 0;

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-white/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedClientIdForDetails(client.id)}
                    >
                      {/* Name & Initials */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#FDF2F5] text-[#B82E69] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs border border-white/80">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#18191B]">{client.name}</div>
                            {client.loyaltyPoints ? (
                              <div className="text-[10px] text-[#B82E69] font-semibold">
                                {client.loyaltyPoints} loyalty pts
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {formatPhoneNumber(client.phone)}
                        </div>
                        {client.email && (
                          <div className="text-[#78616C] text-[11px] flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />
                            {client.email}
                          </div>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/80 text-slate-700 border border-white/80 shadow-2xs">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          {getBranchDisplayName(client.branchId)}
                        </span>
                      </td>

                      {/* Acquisition Source */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] font-semibold bg-white/70 border-white/80 shadow-2xs">
                          {client.source || 'WALK_IN'}
                        </Badge>
                        {client.sourceDetails && (
                          <div className="text-[10px] text-[#78616C] mt-0.5 max-w-[140px] truncate">
                            {client.sourceDetails}
                          </div>
                        )}
                      </td>

                      {/* Visits */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="font-bold text-[#18191B] font-mono tabular-nums">{client.totalVisits || 0}</span>
                        {client.lastVisitDate && (
                          <span className="block text-[10px] text-[#78616C]">
                            Last: {client.lastVisitDate}
                          </span>
                        )}
                      </td>

                      {/* Outstanding Dues */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {hasDues ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF2F5] text-[#B82E69] border border-white/60 shadow-2xs font-mono tabular-nums">
                            {formatCurrency(client.outstandingBalance)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium font-mono">PKR 0</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {client.isArchived ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-500 border-white/60 text-[10px]">
                            Archived
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 border-white/60 text-[10px]">
                            Active
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedClientIdForDetails(client.id)}
                            className="h-8 px-2.5 text-slate-600 hover:text-[#B82E69] hover:bg-[#FDF2F5] text-xs gap-1 rounded-xl transition-colors"
                            title="View History & Invoices"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setClientToEdit(client);
                              setIsFormModalOpen(true);
                            }}
                            className="h-8 px-2.5 text-slate-600 hover:text-[#B82E69] hover:bg-[#FDF2F5] text-xs gap-1 rounded-xl transition-colors"
                            title="Edit Profile"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBookingClient(client);
                            }}
                            className="h-8 px-2.5 text-slate-600 hover:text-[#B82E69] hover:bg-[#FDF2F5] text-xs gap-1 rounded-xl transition-colors"
                            title="New Appointment"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/pos?clientId=${client.id}`)}
                            className="h-8 px-2.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 text-xs gap-1 rounded-xl transition-colors"
                            title="Open in POS"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleArchive(client)}
                            className={`h-8 px-2.5 text-xs gap-1 rounded-xl transition-colors ${
                              client.isArchived
                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={client.isArchived ? 'Restore Client' : 'Archive Client'}
                          >
                            {client.isArchived ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Client Modal */}
      <ClientFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setClientToEdit(null);
        }}
        onSuccess={() => {
          setIsFormModalOpen(false);
          setClientToEdit(null);
          fetchClients();
        }}
        clientToEdit={clientToEdit}
        activeBranchId={selectedBranchId !== 'ALL' ? selectedBranchId : branches[0]?.id || ''}
        branches={branches}
      />

      {/* Client Full Details & History Modal */}
      <ClientDetailsModal
        isOpen={Boolean(selectedClientIdForDetails)}
        onClose={() => setSelectedClientIdForDetails(null)}
        clientId={selectedClientIdForDetails}
        onEdit={(cl) => {
          setSelectedClientIdForDetails(null);
          setClientToEdit(cl);
          setIsFormModalOpen(true);
        }}
        onBookAppointment={(cl) => {
          setSelectedClientIdForDetails(null);
          setBookingClient(cl);
        }}
        onOpenPOS={(cl) => {
          setSelectedClientIdForDetails(null);
          navigate(`/pos?clientId=${cl.id}`);
        }}
        onRefreshList={fetchClients}
      />

      {/* Quick Booking Form Modal from Client Directory */}
      {bookingClient && (
        <BookingFormModal
          isOpen={Boolean(bookingClient)}
          onClose={() => setBookingClient(null)}
          onSuccess={() => {
            setBookingClient(null);
            fetchClients();
          }}
          activeBranchId={bookingClient.branchId || branches[0]?.id || ''}
          branches={branches}
        />
      )}
    </div>
  );
};
