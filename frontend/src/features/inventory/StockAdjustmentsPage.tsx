import { BranchActionField } from '@/components/BranchActionField';
import { useInventoryActionScope } from './useInventoryActionScope';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
import {
  StockMovement,
  StockMovementType,
  InventoryItem,
  InventoryBatch,
  CreateManualStockOutInput,
  CreateStockSettlementInput,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { InventoryNavHeader } from './InventoryNavHeader';
import { LuxurySelect } from '@/components/ui';
import {
  RefreshCw,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Loader2,
  X,
  FileText,
  ClipboardCheck,
} from 'lucide-react';

const formatPKR = (amt: number) => {
  return (Number(amt) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const StockAdjustmentsPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();
  const { navigate } = useRouter();

  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/operations/stock-adjustments" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const defaultBranchId = isSuperAdmin
    ? (activeBranchId !== 'ALL' ? activeBranchId : allBranches[0]?.id || '')
    : (user.branchId || '');

  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<string>('DAMAGED_OUT');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('Damaged / Broken container');

  // Physical Audit Settlement Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditItemId, setAuditItemId] = useState<string>('');
  const [auditCountedQuantity, setAuditCountedQuantity] = useState<number>(0);
  const [auditNotes, setAuditNotes] = useState<string>('Monthly physical stock count verification');

  const loadData = useCallback(async (bId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [moveList, itemList, batchList] = await Promise.all([
        salonService.getStockMovements(bId || 'ALL', undefined, user).catch(() => []),
        salonService.getInventoryItems(bId || 'ALL', user).catch(() => []),
        salonService.getInventoryBatches(bId || 'ALL', undefined, user).catch(() => []),
      ]);

      setMovements(moveList);
      setItems(itemList);
      setBatches(batchList);

      const smap: Record<string, number> = {};
      itemList.forEach((it) => {
        const itemBatches = batchList.filter((b) => b.itemId === it.id && (bId === 'ALL' || b.branchId === bId));
        smap[it.id] = itemBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
      });
      setStockMap(smap);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load stock movements and adjustments.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData(selectedBranchId);
  }, [loadData, selectedBranchId]);

  // KPIs
  const kpis = useMemo(() => {
    let damagedLoss = 0;
    let expiredLoss = 0;
    let totalAdjustments = 0;

    movements.forEach((m) => {
      const cost = Math.abs(m.totalCostImpact || 0);
      if (m.movementType === 'DAMAGED_OUT') {
        damagedLoss += cost;
        totalAdjustments++;
      } else if (m.movementType === 'EXPIRED_OUT') {
        expiredLoss += cost;
        totalAdjustments++;
      } else if (m.movementType === 'NEGATIVE_ADJUSTMENT' || m.movementType === 'POSITIVE_ADJUSTMENT') {
        totalAdjustments++;
      }
    });

    return {
      totalMovements: movements.length,
      totalAdjustments,
      damagedLoss,
      expiredLoss,
    };
  }, [movements]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches =
          (m.movementNumber && m.movementNumber.toLowerCase().includes(q)) ||
          (m.itemName && m.itemName.toLowerCase().includes(q)) ||
          (m.reason && m.reason.toLowerCase().includes(q)) ||
          (m.createdByName && m.createdByName.toLowerCase().includes(q));
        if (!matches) return false;
      }

      if (typeFilter !== 'ALL' && m.movementType !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [movements, searchQuery, typeFilter]);

  const actionScope = useInventoryActionScope(isAdjustModalOpen || isAuditModalOpen);
  const changeActionBranch = (id: string) => {
    actionScope.setBranchId(id);
    setSelectedItemId(''); setAuditItemId(''); setAuditCountedQuantity(0);
  };

  // Open Adjustment Modal
  const handleOpenAdjustModal = () => {
    setSelectedItemId(actionScope.items[0]?.id || '');
    setAdjustmentType('DAMAGED_OUT');
    setAdjustQuantity(1);
    setAdjustReason('Damaged / Broken packaging');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionScope.validate()) return;
    if (!selectedItemId) {
      setErrorMessage('Please select a product.');
      return;
    }
    const currentOnHand = actionScope.stockMap[selectedItemId] ?? 0;
    if (adjustQuantity <= 0) {
      setErrorMessage('Quantity must be greater than 0.');
      return;
    }
    if (adjustQuantity > currentOnHand) {
      setErrorMessage(`Cannot adjust out ${adjustQuantity} units. Only ${currentOnHand} units currently on hand.`);
      return;
    }

    try {
      const input: CreateManualStockOutInput = {
        branchId: actionScope.branchId,
        itemId: selectedItemId,
        quantity: Number(adjustQuantity),
        reason: (adjustmentType as any) || 'DAMAGED_OUT',
        notes: adjustReason,
      };

      await salonService.createManualStockOut(input, user);
      const msg = `Stock adjustment of ${adjustQuantity} units recorded.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsAdjustModalOpen(false);
      loadData(selectedBranchId);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to record stock adjustment.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
    }
  };

  // Open Audit Settlement Modal
  const handleOpenAuditModal = () => {
    const first = actionScope.items[0];
    setAuditItemId(first?.id || '');
    setAuditCountedQuantity(first ? (actionScope.stockMap[first.id] ?? 0) : 0);
    setAuditNotes('Physical cycle count reconciliation');
    setIsAuditModalOpen(true);
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionScope.validate()) return;
    if (!auditItemId) return;
    const currentExpected = actionScope.stockMap[auditItemId] ?? 0;
    const variance = Number(auditCountedQuantity) - currentExpected;

    try {
      const input: CreateStockSettlementInput = {
        branchId: actionScope.branchId,
        countDate: new Date().toISOString().split('T')[0],
        notes: auditNotes,
        lines: [
          {
            itemId: auditItemId,
            systemQuantity: currentExpected,
            countedQuantity: Number(auditCountedQuantity),
            reason: variance < 0 ? 'MISSING' : variance > 0 ? 'COUNTING_CORRECTION' : 'COUNTING_CORRECTION',
            notes: `Physical count: ${auditCountedQuantity}, system expected: ${currentExpected}`,
          },
        ],
      };

      await salonService.createStockSettlement(input, user);
      const msg = `Physical count reconciled. Variance of ${variance >= 0 ? `+${variance}` : variance} units balanced in inventory.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsAuditModalOpen(false);
      loadData(selectedBranchId);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to record stock audit settlement.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <InventoryNavHeader
        title="Stock Adjustments & Waste Reconciliation"
        subtitle="Record inventory shrinkage, damaged goods, expired stock write-offs and physical count reconciliation."
        icon={<RefreshCw className="w-6 h-6 text-[#B82E69]" />}
        activePath="/operations/stock-adjustments"
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        primaryAction={{
          label: 'Record Stock Adjustment',
          icon: <Plus className="w-4 h-4" />,
          onClick: handleOpenAdjustModal,
        }}
        secondaryAction={{
          label: 'Physical Count Audit',
          icon: <ClipboardCheck className="w-4 h-4 text-[#B82E69]" />,
          onClick: handleOpenAuditModal,
        }}
      />

      {/* KPI Cards: Pure White Frosted Glass (Zero Wavy Lines, Zero Watermarks) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Movements */}
        <div className="group relative overflow-hidden rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:bg-white/85 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Movements
            </span>
            <div className="w-8 h-8 rounded-2xl bg-white/90 border border-white/80 shadow-2xs flex items-center justify-center text-[#B82E69] shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#18191B] tracking-tight">
            {kpis.totalMovements}
          </div>
          <div className="text-[11px] font-medium text-slate-400 mt-1 truncate">
            IN / OUT inventory log entries
          </div>
        </div>

        {/* Damaged Stock Loss */}
        <div className="group relative overflow-hidden rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:bg-white/85 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-700/80 uppercase tracking-wider">
              Damaged Stock Loss
            </span>
            <div className="w-8 h-8 rounded-2xl bg-amber-50/80 border border-amber-200/50 shadow-2xs flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-950 tracking-tight truncate">
            PKR {formatPKR(kpis.damagedLoss)}
          </div>
          <div className="text-[11px] font-semibold text-amber-700 mt-1 truncate">
            Loss from damaged items
          </div>
        </div>

        {/* Expired Stock Loss */}
        <div className="group relative overflow-hidden rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:bg-white/85 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-rose-700/80 uppercase tracking-wider">
              Expired Stock Loss
            </span>
            <div className="w-8 h-8 rounded-2xl bg-rose-50/80 border border-rose-200/50 shadow-2xs flex items-center justify-center text-rose-600 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-950 tracking-tight truncate">
            PKR {formatPKR(kpis.expiredLoss)}
          </div>
          <div className="text-[11px] font-semibold text-rose-700 mt-1 truncate">
            Loss from expired batches
          </div>
        </div>
      </div>

      {/* Filter and Search Bar: Frosted Card */}
      <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search movements, item name, reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-white/90 bg-white/70 backdrop-blur-xl focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-[#B82E69]/10 text-[#18191B] font-medium shadow-2xs transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="w-full sm:w-auto">
          <LuxurySelect
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={[
              { value: 'ALL', label: 'All Movement Types' },
              { value: 'PURCHASE_IN', label: 'Purchase In' },
              { value: 'POS_SALE', label: 'POS Sale' },
              { value: 'SALON_CONSUMPTION', label: 'Salon In-House Use' },
              { value: 'DAMAGED_OUT', label: 'Damaged Out' },
              { value: 'EXPIRED_OUT', label: 'Expired Out' },
              { value: 'NEGATIVE_ADJUSTMENT', label: 'Negative Adjustment' },
              { value: 'POSITIVE_ADJUSTMENT', label: 'Positive Adjustment' },
            ]}
            triggerClassName="w-56 text-xs font-semibold rounded-2xl border-white/90 bg-white/70 backdrop-blur-xl"
          />
        </div>
      </div>

      {/* Main Table: Luxury Frosted Container */}
      <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 bg-white/50 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/90 border border-white/80 shadow-2xs flex items-center justify-center text-[#B82E69]">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#18191B] tracking-tight">
                Stock Movements & Adjustments Audit Log
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {filteredMovements.length} audit trail records found
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full border-3 border-[#F1DEE3] border-t-[#B82E69] animate-spin mb-3" />
            <p className="text-slate-600 text-sm font-medium">Loading stock movements...</p>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/90 border border-white/80 shadow-2xs flex items-center justify-center text-slate-400 mb-3">
              <RefreshCw className="w-7 h-7 stroke-[1.5]" />
            </div>
            <p className="text-[#18191B] text-sm font-bold mb-1">No movements found</p>
            <p className="text-slate-400 text-xs mb-4">Stock adjustments and consumption will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-center w-12">#</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Movement #</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3.5 px-4 min-w-[190px]">Product Name</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Movement Type</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap font-bold">Qty Change</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Cost Value</th>
                  <th className="py-3.5 px-4 min-w-[180px]">Reason / Notes</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredMovements.map((m, idx) => {
                  const isIncoming = m.direction === 'IN' || m.movementType.includes('IN') || m.movementType.includes('POSITIVE');

                  return (
                    <tr key={m.id} className="hover:bg-rose-50/20 transition-colors">
                      <td className="py-3.5 px-4 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-[#B82E69]">
                        {m.movementNumber}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {formatDate(m.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#18191B]">
                        {m.itemName}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/90 border border-white/80 shadow-2xs text-[#18191B]">
                          {m.movementType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isIncoming ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                            +{m.quantity}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/60 shadow-2xs">
                            -{m.quantity}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-[#18191B] whitespace-nowrap">
                        PKR {formatPKR(Math.abs(m.totalCostImpact || 0))}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs font-medium">
                        {m.reason || m.notes || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 text-xs font-medium">
                        {m.createdByName || 'Staff'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MODAL: RECORD STOCK ADJUSTMENT --- */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Record Stock Adjustment / Write-Off</span>
              </h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 pt-4">
              <BranchActionField value={actionScope.branchId} onChange={changeActionBranch} disabled={false} />
              {actionScope.error && <p role="alert" className="text-xs text-rose-600">{actionScope.error}</p>}
              {actionScope.loading && <p role="status" className="text-xs text-slate-500">Loading branch data...</p>}
              <fieldset disabled={!actionScope.ready} className="space-y-4 disabled:opacity-50">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Product *
                </label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden"
                >
                  <option value="">Select a product</option>
                  {actionScope.items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.sku}) — Stock On Hand: {actionScope.stockMap[it.id] ?? 0} {it.purchaseUnit}
                    </option>
                  ))}
                </select>
                {selectedItemId && (
                  <div className="mt-1.5 text-xs text-[#9D2558] font-semibold">
                    Current Stock on Hand: {actionScope.stockMap[selectedItemId] ?? 0} Units
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adjustment Type *
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden"
                  >
                    <option value="DAMAGED_OUT">Damaged / Broken Out</option>
                    <option value="EXPIRED_OUT">Expired Stock Out</option>
                    <option value="SALON_CONSUMPTION">Salon In-House Use</option>
                    <option value="NEGATIVE_ADJUSTMENT">Negative Count Adjustment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quantity to Adjust Out *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={actionScope.stockMap[selectedItemId] ?? undefined}
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#9D2558]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Explanation
                </label>
                <textarea
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Broken bottle during shift cleaning"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
                >
                  Confirm Adjustment
                </button>
              </div>
            
              </fieldset>
</form>
          </div>
        </div>
      )}

      {/* --- MODAL: PHYSICAL STOCK COUNT AUDIT --- */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#9D2558]" />
                <span>Physical Stock Count Audit</span>
              </h3>
              <button onClick={() => setIsAuditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAudit} className="space-y-4 pt-4">
              <BranchActionField value={actionScope.branchId} onChange={changeActionBranch} disabled={false} />
              {actionScope.error && <p role="alert" className="text-xs text-rose-600">{actionScope.error}</p>}
              {actionScope.loading && <p role="status" className="text-xs text-slate-500">Loading branch data...</p>}
              <fieldset disabled={!actionScope.ready} className="space-y-4 disabled:opacity-50">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Product *
                </label>
                <select
                  required
                  value={auditItemId}
                  onChange={(e) => {
                    setAuditItemId(e.target.value);
                    setAuditCountedQuantity(actionScope.stockMap[e.target.value] ?? 0);
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden"
                >
                  <option value="">Select a product</option>
                  {actionScope.items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">System Stock</span>
                  <div className="text-lg font-bold text-slate-900">
                    {actionScope.stockMap[auditItemId] ?? 0} Units
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Physically Counted *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={auditCountedQuantity}
                    onChange={(e) => setAuditCountedQuantity(Number(e.target.value))}
                    className="w-full text-base font-bold text-[#9D2558] px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Variance Preview */}
              {(() => {
                const exp = actionScope.stockMap[auditItemId] ?? 0;
                const variance = Number(auditCountedQuantity) - exp;
                return (
                  <div className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
                    variance === 0
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : variance < 0
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-[#FDF2F5] text-[#23151D] border border-[#F1DEE3]'
                  }`}>
                    <span>Physical Variance:</span>
                    <span>
                      {variance === 0 ? 'Exact Match (0 Variance)' : `${variance > 0 ? `+${variance}` : variance} Units`}
                    </span>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audit Notes / Reason
                </label>
                <input
                  type="text"
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#9D2558] hover:bg-[#851C47] rounded-lg shadow-xs"
                >
                  Reconcile Count
                </button>
              </div>
            
              </fieldset>
</form>
          </div>
        </div>
      )}
    </div>
  );
};
export default StockAdjustmentsPage;
