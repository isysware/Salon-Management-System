import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { PortalType } from '@/types/auth';
import { getDefaultRouteForRole } from '@/lib/permissions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { toast } from '@/context/ToastContext';
import {
  Scissors,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Building2,
  Coins,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { navigate } = useRouter();

  const [selectedPortal, setSelectedPortal] = useState<PortalType>('SUPER_ADMIN');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Restore remembered identifier on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const remembered = localStorage.getItem('isysware_salon_remembered_id');
      if (remembered) {
        setIdentifier(remembered);
        setRememberMe(true);
      }
    }
  }, []);

  const handlePortalChange = (newPortal: string) => {
    setSelectedPortal(newPortal as PortalType);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      const msg = 'Please enter your email or username.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (!password) {
      const msg = 'Please enter your password.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await login({
        portal: selectedPortal,
        identifier: identifier.trim(),
        password,
        rememberMe,
      });

      toast.success('Signed in successfully!');
      const destination = getDefaultRouteForRole(session.user.role);
      navigate(destination);
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FAF8F9] font-sans relative overflow-hidden">
      {/* AMBIENT LUXURY BLUR GLOW LIGHTS (WARM ROSE VELVET LIGHTING) */}
      <div className="fixed -top-20 -left-20 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#FCE4EC]/70 via-[#F8BBD0]/40 to-transparent blur-[140px] pointer-events-none -z-0" />
      <div className="fixed top-[20%] -right-20 w-[650px] h-[650px] rounded-full bg-gradient-to-bl from-[#FFF0F5]/85 via-[#F8D2DC]/50 to-transparent blur-[150px] pointer-events-none -z-0" />
      <div className="fixed -bottom-24 right-[30%] w-[700px] h-[500px] rounded-full bg-gradient-to-tr from-[#FAF0F3]/80 via-[#FCE4EC]/40 to-transparent blur-[160px] pointer-events-none -z-0" />

      {/* LEFT BRANDING PANEL (~60% on Desktop - VELVET WINE & PLUM THEME) */}
      <div className="relative w-full lg:w-[58%] xl:w-[62%] bg-gradient-to-br from-[#9D2558] via-[#851C47] to-[#450A24] text-white p-6 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-between overflow-hidden z-10 shadow-2xl">
        {/* Subtle Decorative Geometric Waves and Velvet Glows */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-[#B82E69]/30 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 rounded-full bg-[#550C2C]/40 blur-3xl pointer-events-none" />

        {/* Decorative Grid Lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>

        {/* Top Brand Lockup */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25 flex items-center justify-center shadow-[0_8px_25px_rgba(0,0,0,0.2)]">
              <Scissors className="w-5 h-5 text-white transform -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">Meerab Salon</span>
                <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 font-semibold text-white backdrop-blur-md border border-white/20">
                  SalonOS
                </span>
              </div>
              <p className="text-[11px] text-[#FCE8EC] font-medium mt-0.5">Luxury Enterprise Salon Suite</p>
            </div>
          </div>
        </div>

        {/* Hero Narrative */}
        <div className="relative z-10 my-8 lg:my-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-medium text-[#FCE8EC] mb-5 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F8BBD0]" />
            <span>Salon Management System · Multi-Branch Workspace</span>
          </div>

          <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            Your salon. Every branch. One luxury workspace.
          </h1>

          <p className="mt-3 text-sm sm:text-base text-[#FCE8EC]/90 font-normal leading-relaxed">
            Unify appointments, POS billing, staff shifts, cash custody, and multi-location financial oversight into a single role-aware operating system.
          </p>

          {/* Three Short Benefit Rows */}
          <div className="mt-7 space-y-4">
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 transition-transform hover:-translate-y-0.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">Multi-Branch Consolidated Control</h4>
                <p className="text-xs text-[#FCE8EC]/85 mt-0.5 leading-relaxed">
                  Toggle between high-level consolidated analytics and branch-specific operational drawers in real-time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 transition-transform hover:-translate-y-0.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">Audited Cash Custody & Shift Settlement</h4>
                <p className="text-xs text-[#FCE8EC]/85 mt-0.5 leading-relaxed">
                  Segregate tips from salon revenue, enforce physical drawer balance accountability, and prevent self-approval.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 transition-transform hover:-translate-y-0.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">Strict Role & Privacy Isolation</h4>
                <p className="text-xs text-[#FCE8EC]/85 mt-0.5 leading-relaxed">
                  Tailored portals for Executives, Branch Managers, Financial Cashiers, and Personal Stylist views.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="relative z-10 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#FCE8EC]/80">
          <p>© 2026 Meerab Salon Management System. All rights reserved.</p>
          <p className="font-medium text-white/90">Powered by iSysware Enterprise</p>
        </div>
      </div>

      {/* RIGHT LOGIN PANEL (~40% on Desktop - FROSTED GLASS LUXURY THEME) */}
      <div className="w-full lg:w-[42%] xl:w-[38%] bg-white/80 backdrop-blur-2xl p-6 sm:p-10 lg:p-12 xl:p-14 flex flex-col justify-between border-l border-white/90 shadow-[0_20px_60px_rgba(35,21,29,0.04)] min-h-screen overflow-y-auto z-10">
        <div className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF2F5] text-[#B82E69] text-xs font-semibold mb-3 border border-[#B82E69]/15 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#B82E69]" />
              <span>Secure Portal Access</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18191B]">Welcome back</h2>
            <p className="text-xs sm:text-sm text-[#78616C] mt-1.5 leading-relaxed">
              Select your role portal and authenticate to access your workspace.
            </p>
          </div>

          {/* Portal Selector Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-[#18191B] mb-2 font-sans uppercase tracking-wider">
              Select Portal Target
            </label>
            <Tabs value={selectedPortal} onValueChange={handlePortalChange} className="w-full">
              <TabsList className="w-full grid grid-cols-4 h-12 p-1.5 bg-[#FAF8F9] border border-white/80 rounded-2xl shadow-inner">
                <TabsTrigger
                  value="SUPER_ADMIN"
                  className="text-xs sm:text-[12.5px] font-semibold py-2 px-1 truncate rounded-xl transition-all data-[state=active]:bg-[#B82E69] data-[state=active]:text-white data-[state=active]:shadow-[0_4px_16px_rgba(184,46,105,0.22)] text-[#78616C]"
                >
                  Super Admin
                </TabsTrigger>
                <TabsTrigger
                  value="ADMIN"
                  className="text-xs sm:text-[12.5px] font-semibold py-2 px-1 truncate rounded-xl transition-all data-[state=active]:bg-[#B82E69] data-[state=active]:text-white data-[state=active]:shadow-[0_4px_16px_rgba(184,46,105,0.22)] text-[#78616C]"
                >
                  Admin
                </TabsTrigger>
                <TabsTrigger
                  value="ACCOUNTANT"
                  className="text-xs sm:text-[12.5px] font-semibold py-2 px-1 truncate rounded-xl transition-all data-[state=active]:bg-[#B82E69] data-[state=active]:text-white data-[state=active]:shadow-[0_4px_16px_rgba(184,46,105,0.22)] text-[#78616C]"
                  title="Sales & Billing Portal"
                >
                  Billing
                </TabsTrigger>
                <TabsTrigger
                  value="STAFF"
                  className="text-xs sm:text-[12.5px] font-semibold py-2 px-1 truncate rounded-xl transition-all data-[state=active]:bg-[#B82E69] data-[state=active]:text-white data-[state=active]:shadow-[0_4px_16px_rgba(184,46,105,0.22)] text-[#78616C]"
                >
                  Staff
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <Alert variant="destructive" className="mb-5 flex items-start gap-2.5 rounded-2xl border-rose-200 bg-rose-50/80">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <AlertTitle className="text-xs font-semibold text-rose-800">
                  Authentication Notice
                </AlertTitle>
                <AlertDescription className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                  {errorMessage}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username or Email"
              type="text"
              required
              autoComplete="username"
              placeholder="e.g. superadmin@isysware.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              leftElement={<Mail className="w-4 h-4 text-[#78616C]" />}
              className="h-12 rounded-xl text-sm bg-white/70 border-white/80 focus:border-[#B82E69] focus:ring-2 focus:ring-[#B82E69]/20"
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Enter your account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftElement={<Lock className="w-4 h-4 text-[#78616C]" />}
              className="h-12 rounded-xl text-sm bg-white/70 border-white/80 focus:border-[#B82E69] focus:ring-2 focus:ring-[#B82E69]/20"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#78616C] hover:text-[#18191B] focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="data-[state=checked]:bg-[#B82E69] data-[state=checked]:border-[#B82E69]"
                />
                <Label htmlFor="remember-me" className="text-xs text-[#78616C] cursor-pointer font-medium">
                  Remember identifier
                </Label>
              </div>

              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-xs font-semibold text-[#B82E69] hover:text-[#A02358] transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="default"
                size="lg"
                isLoading={isSubmitting}
                className="w-full h-12 rounded-xl font-semibold text-sm bg-[#B82E69] hover:bg-[#A02358] text-white shadow-[0_8px_25px_rgba(184,46,105,0.28)] transition-all cursor-pointer"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Login to Portal
              </Button>
            </div>
          </form>
        </div>

        {/* Bottom Security Footer */}
        <div className="w-full max-w-md mx-auto pt-6 border-t border-black/5 mt-6 flex items-center justify-between text-xs text-[#78616C]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            256-bit Encrypted Session
          </span>
          <span>v2.1 · PRA / SRB Certified</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        portal={selectedPortal}
        initialIdentifier={identifier}
      />
    </div>
  );
};
