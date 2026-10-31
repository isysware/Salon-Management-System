import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  Users,
  HardDrive,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UploadCloud,
  FileText,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';

const API_BASE = 'http://localhost:5000/api/v1';

export const BillingPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [billingData, setBillingData] = useState<any>(null);

  // Form
  const [amount, setAmount] = useState<number>(12000);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [transactionRef, setTransactionRef] = useState('');
  const [slipAttachmentUrl, setSlipAttachmentUrl] = useState('');

  const fetchBilling = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/tenant/billing`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setBillingData(data.data);
        if (data.data?.subscription?.plan?.monthlyPrice) {
          setAmount(Number(data.data.subscription.plan.monthlyPrice));
        }
      } else {
        toast.error(data.error?.message || 'Failed to load billing information');
      }
    } catch (err: any) {
      toast.error('Network error loading billing information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handleSubmitSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionRef.trim()) {
      toast.error('Please enter the transaction reference / bank receipt number');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/tenant/billing/submit-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          paymentMethod,
          transactionRef,
          slipAttachmentUrl,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Payment receipt submitted! Platform admins will verify and extend your subscription.');
        setTransactionRef('');
        setSlipAttachmentUrl('');
        fetchBilling();
      } else {
        toast.error(data.error?.message || 'Failed to submit receipt');
      }
    } catch (err: any) {
      toast.error('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  const sub = billingData?.subscription;
  const quotas = billingData?.quotas;
  const tenant = billingData?.tenant;
  const instructions = billingData?.paymentInstructions;
  const history = billingData?.paymentHistory || [];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subscription & Plan Billing</h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                sub?.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {sub?.status || 'TRIAL'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage your salon plan tier, branch limits, and renewal payments
          </p>
        </div>

        <button
          onClick={fetchBilling}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Grace Period / Past Due Alert Banner */}
      {sub?.isPastDue && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">Subscription Renewal Overdue</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Your subscription billing period has ended. You have a {tenant?.gracePeriodDays || 7}-day grace period
              active. Please submit your renewal receipt below to avoid service suspension.
            </p>
          </div>
        </div>
      )}

      {/* Plan & Quotas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Plan Card */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl" />
          <div>
            <div className="flex items-center justify-between text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <span>Current Salon Tier</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-2xl font-black">{sub?.plan?.name || 'Growth Plan'}</h3>
            <div className="text-xs text-indigo-200/80 font-mono mt-0.5">Code: {sub?.plan?.code}</div>

            <div className="mt-6 pt-6 border-t border-indigo-800/60">
              <span className="text-3xl font-extrabold">
                PKR {Number(sub?.plan?.monthlyPrice || 0).toLocaleString()}
              </span>
              <span className="text-xs text-indigo-200 ml-1.5">/ {sub?.billingCycle?.toLowerCase()}</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-indigo-800/60 text-xs space-y-1.5">
            <div className="flex justify-between text-indigo-200">
              <span>Next Renewal Date:</span>
              <span className="font-semibold text-white">
                {sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-indigo-200">
              <span>Days Remaining:</span>
              <span className="font-semibold text-amber-300">{sub?.daysRemaining ?? 0} days</span>
            </div>
          </div>
        </div>

        {/* Quota Usage Cards */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Resource Quota Usage</h3>
            <p className="text-xs text-slate-500 mb-6">
              Usage tracked across all branches of <span className="font-semibold text-slate-700">{tenant?.name}</span>
            </p>

            <div className="space-y-5">
              {/* Branches */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Active Branches
                  </span>
                  <span>
                    {quotas?.branches?.used} of {quotas?.branches?.max} used
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((quotas?.branches?.used || 1) / (quotas?.branches?.max || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Staff */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" /> Staff Profiles
                  </span>
                  <span>
                    {quotas?.staff?.used} of {quotas?.staff?.max} used
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((quotas?.staff?.used || 1) / (quotas?.staff?.max || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Devices */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-600" /> Connected Devices
                  </span>
                  <span>
                    {quotas?.devices?.used} of {quotas?.devices?.max} used
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((quotas?.devices?.used || 1) / (quotas?.devices?.max || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Need more branches or staff slots?</span>
            <span className="text-indigo-600 font-semibold cursor-pointer hover:underline">
              Contact Platform Admin to Upgrade Plan
            </span>
          </div>
        </div>
      </div>

      {/* Renewal Bank Instructions & Upload Slip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Instructions */}
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">SaaS Bank Account Details</h3>
          </div>
          <p className="text-xs text-slate-600 mb-5">
            Transfer your monthly or annual subscription fee directly to our platform merchant accounts:
          </p>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 text-xs font-mono">
            <div>
              <span className="text-slate-400">Bank Name:</span>{' '}
              <span className="text-slate-900 font-bold">{instructions?.bankName}</span>
            </div>
            <div>
              <span className="text-slate-400">Account Title:</span>{' '}
              <span className="text-slate-900 font-bold">{instructions?.accountTitle}</span>
            </div>
            <div>
              <span className="text-slate-400">IBAN:</span>{' '}
              <span className="text-indigo-600 font-bold select-all">{instructions?.iban}</span>
            </div>
            <div>
              <span className="text-slate-400">Account Number:</span>{' '}
              <span className="text-slate-800 font-bold select-all">{instructions?.accountNumber}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between">
              <span>JazzCash / EasyPaisa:</span>
              <span className="font-bold text-slate-900">{instructions?.jazzCash}</span>
            </div>
          </div>
        </div>

        {/* Submit Slip Form */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <UploadCloud className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Submit Payment Slip</h3>
          </div>

          <form onSubmit={handleSubmitSlip} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Amount Paid (PKR)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option value="BANK_TRANSFER">Bank IBAN Transfer</option>
                  <option value="JAZZCASH">JazzCash</option>
                  <option value="EASYPAISA">EasyPaisa</option>
                  <option value="CASH">Cash Deposit</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Transaction Reference / Slip #
              </label>
              <input
                type="text"
                placeholder="e.g. MEZN-938210492 or JazzCash TID"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Screenshot / Receipt URL (Optional)
              </label>
              <input
                type="text"
                placeholder="https://... receipt image link"
                value={slipAttachmentUrl}
                onChange={(e) => setSlipAttachmentUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Submit Slip for Verification'}
            </button>
          </form>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4">Subscription Payment History</h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No payment submissions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h: any) => (
                  <tr key={h.id}>
                    <td className="py-3 px-3 text-slate-600">{new Date(h.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">PKR {Number(h.amount).toLocaleString()}</td>
                    <td className="py-3 px-3 text-slate-600">{h.paymentMethod}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{h.transactionRef}</td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          h.status === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : h.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

