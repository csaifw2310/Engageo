import { useState, useEffect } from 'react';
import { Crown, Loader2, AlertCircle, Check, ArrowUpRight, X, Sparkles, AlertTriangle, XCircle, ArrowDown, ChevronLeft } from 'lucide-react';
import { billingApi, type Plan } from '../api/billingApi';
import { useApiData } from '../hooks/useApiData';
import { openRazorpayCheckout } from '../lib/Razorpaycheckout';
import { usePendingPaymentTimer } from '../hooks/usePendingPaymentTimer';

const UNLIMITED = -1;

function limitLabel(limit: number) {
  return limit === UNLIMITED ? 'Unlimited' : limit.toLocaleString();
}

function formatINR(amountInPaiseOrRupees: number, isPaise = false) {
  const rupees = isPaise ? amountInPaiseOrRupees / 100 : amountInPaiseOrRupees;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

function getYearlySavingsPercent(priceMonthly: number, priceYearly: number) {
  if (priceMonthly === 0) return 0;
  const fullYear = priceMonthly * 12;
  return Math.round(((fullYear - priceYearly) / fullYear) * 100);
}

export function BillingPage() {
  const { data: summaryRes, loading, error, refetch: refetchSummary } = useApiData(() => billingApi.getSummary(), []);
  const { data: plansRes } = useApiData(() => billingApi.getPlans(), []);
  const { data: paymentsRes, refetch: refetchPayments } = useApiData(() => billingApi.getPayments({ page: 1, limit: 20 }), []);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const {
    isLocked,
    formattedTime,
    startCooldown,
    clearCooldown,
  } = usePendingPaymentTimer();

  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [downgradeStep, setDowngradeStep] = useState<1 | 2 | 3>(1);
  const [downgradeChecked, setDowngradeChecked] = useState(false);
  const [downgradePlan, setDowngradePlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (!downgradeOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDowngradeModal();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [downgradeOpen]);

  function openDowngradeModal(plan: Plan) {
    setDowngradePlan(plan);
    setDowngradeStep(1);
    setDowngradeChecked(false);
    setDowngradeOpen(true);
  }

  function closeDowngradeModal() {
    setDowngradeOpen(false);
    setDowngradeStep(1);
    setDowngradeChecked(false);
    setDowngradePlan(null);
  }

  async function confirmDowngrade() {
    if (!downgradePlan) return;
    const plan = downgradePlan;
    closeDowngradeModal();
    await handleUpgrade(plan);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400">
        <AlertCircle className="w-5 h-5 shrink-0" /><p className="text-sm">{error}</p>
      </div>
    );
  }

  const summary = summaryRes?.data;
  const planName = summary?.plan ?? 'Free';
  const status = (summary?.status ?? 'active').toLowerCase();
  const plans: Plan[] = plansRes?.data ?? [];
  const currentPlan = plans.find(p => p.name === planName);
  const features = currentPlan?.features ?? [];
  const payments = paymentsRes?.data?.payments ?? [];
  const isFreePlan = planName.toLowerCase() === 'free';

  const usageItems = summary ? [
    { label: 'Messages', used: summary.messagesUsed, limit: summary.messagesLimit },
    { label: 'Contacts', used: summary.contactsUsed, limit: summary.contactsLimit },
    { label: 'Campaigns', used: summary.campaignsUsed, limit: summary.campaignsLimit },
  ] : [];

  async function handleUpgrade(plan: Plan) {
    setUpgradeError(null);
    setUpgradingPlanId(plan._id);

    try {
        const res = await billingApi.upgradeSubscription({
          planId: plan._id,
          billingCycle: billingCycle === 'monthly'
            ? 'MONTHLY'
            : 'YEARLY',
          autoRenew: true,
        });

      const { paymentOrder } = res.data;

      if (!paymentOrder) {
        await refetchSummary();
        setUpgradingPlanId(null);
        return;
      }

      await openRazorpayCheckout({
        order: paymentOrder,
        planName: plan.name,
        onSuccess: async (response) => {
          await billingApi.verifyPayment(response);
          clearCooldown();
          await Promise.all([refetchSummary(), refetchPayments()]);
          setUpgradingPlanId(null);
        },
        onDismiss: () => {
          setUpgradingPlanId(null);
        },
      });
    } catch (err: any) {
      if (
        err?.response?.status === 409 &&
        err?.response?.data?.message?.toLowerCase().includes('pending')
      ) {
        startCooldown();
      }

      if (err?.message !== 'Checkout dismissed by user') {
        setUpgradeError(
          err?.response?.data?.message || err?.error?.description || 'Upgrade failed. Please try again.'
        );
      }
      setUpgradingPlanId(null);
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-medium">Billing</h1>
        <p className="text-sm text-zinc-500">Manage your subscription and usage</p>
      </div>

      {upgradeError && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{upgradeError}</p>
          </div>
          <button onClick={() => setUpgradeError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Current Plan */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
              <Crown className="w-6 h-6 text-zinc-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">{planName} Plan</h3>
                <span className={`badge ${status === 'active' ? 'badge-success' : status === 'pending' ? 'badge-info' : status === 'expired' ? 'badge-error' : 'badge-warning'}`}>
                  {status}
                </span>
              </div>
              <p className="text-sm text-zinc-500">
                {summary?.billingCycle ? `${summary.billingCycle.toLowerCase()} billing` : 'No active billing cycle'}
                {summary?.expiresAt && ` · Renews ${new Date(summary.expiresAt).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          {isFreePlan && (
            isLocked ? (
              <span
                aria-disabled="true"
                title="Payment verification in progress"
                className="shrink-0 inline-flex items-center gap-1.5 bg-white/40 text-zinc-950/60 cursor-not-allowed transition-colors text-sm font-medium px-4 py-2 rounded-lg"
              >
                Upgrade
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            ) : (
              <a
                href="#upgrade-plans"
                className="shrink-0 inline-flex items-center gap-1.5 bg-white text-zinc-950 hover:bg-zinc-200 transition-colors text-sm font-medium px-4 py-2 rounded-lg"
              >
                Upgrade
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            )
          )}
        </div>

        {features.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800 grid sm:grid-cols-2 gap-2">
            {features.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage */}
      <div className="grid sm:grid-cols-3 gap-4">
        {usageItems.map((item) => {
          const unlimited = item.limit === UNLIMITED;
          const pct = !unlimited && item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
          return (
            <div key={item.label} className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-500">{item.label}</span>
                <span className="text-xs text-zinc-500">{limitLabel(item.limit)} limit</span>
              </div>
              <p className="text-2xl font-semibold mb-2">{item.used.toLocaleString()}</p>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-white'}`}
                  style={{ width: `${unlimited ? 0 : pct}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-2">{unlimited ? 'Unlimited' : `${pct.toFixed(1)}% used`}</p>
            </div>
          );
        })}
      </div>

      {/* ── Upgrade Plans (landing-page styled) ── */}
      <div
        id="upgrade-plans"
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0B] p-6 sm:p-8 scroll-mt-6"
      >
        {/* ambient glow, echoes the landing page hero */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[-30%] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-500/[0.08] blur-[110px]" />
        </div>

        <div className="relative">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-8">
            <div>
              <p className="text-xs text-emerald-400/80 mb-1.5 font-medium tracking-wide uppercase">Pricing</p>
              <h3 className="text-lg font-semibold tracking-tight mb-1">Plans for every stage</h3>
              <p className="text-sm text-zinc-500">Upgrade anytime — your usage carries over instantly.</p>
            </div>

            {/* Billing cycle toggle */}
            <div className="inline-flex items-center p-1 rounded-lg bg-white/[0.04] border border-white/10 self-start sm:self-auto">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${billingCycle === 'monthly' ? 'bg-white text-zinc-950 font-medium' : 'text-zinc-400 hover:text-white'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${billingCycle === 'yearly' ? 'bg-white text-zinc-950 font-medium' : 'text-zinc-400 hover:text-white'}`}
              >
                Yearly
              </button>
            </div>
          </div>

          {isLocked && (
            <div className="relative overflow-hidden mb-6 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.12] via-amber-900/[0.08] to-transparent p-5 sm:p-6">
              {/* soft ambient glow */}
              <div className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-amber-500/20 blur-[60px]" />

              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="relative shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/15 ring-1 ring-amber-400/20 shadow-[0_0_22px_rgba(245,158,11,0.35)]">
                    <AlertCircle className="w-6 h-6 text-amber-400" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-amber-300 tracking-tight">
                      Please wait before trying again
                    </p>
                    <p className="text-sm text-amber-400/70 mt-1 max-w-md leading-relaxed">
                      A recent payment attempt is still active. You can try again once the cooldown expires.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 self-start sm:self-center inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-full bg-amber-500/10 border border-amber-400/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-amber-300">{formattedTime}</span>
                </div>
              </div>
            </div>
          )}

          {plans.length === 0 ? (
            <p className="text-sm text-zinc-600 py-10 text-center">No plans available right now.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl">
              {plans.map((plan) => {
                const isCurrent = plan.name.toLowerCase() === planName.toLowerCase();
                const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
                const isPopular = plan.name.toLowerCase() === 'growth';
                const isBusy = upgradingPlanId === plan._id;
                const savings = getYearlySavingsPercent(plan.priceMonthly, plan.priceYearly);

                return (
                  <div
                    key={plan._id}
                    className={`relative flex flex-col p-5 sm:p-6 rounded-xl border transition-all duration-200 ${
                      isPopular
                        ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent hover:from-emerald-500/[0.11]'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                    } ${isCurrent ? 'ring-1 ring-inset ring-zinc-700' : 'hover:-translate-y-0.5'}`}
                  >
                    {/* Most popular badge */}
                    {isPopular && (
                      <span className="absolute -top-3 left-6 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500 text-zinc-950">
                        <Sparkles className="w-3 h-3" />
                        Most popular
                      </span>
                    )}

                    {/* Plan name + current badge */}
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-[15px]">{plan.name}</h4>
                      {isCurrent && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          Current
                        </span>
                      )}
                    </div>

                    {/* Message limit sub-label */}
                    <p className="text-sm text-zinc-500 mb-5">
                      {limitLabel(plan.maxMessagesPerMonth ?? plan.messageLimit)} messages/mo
                    </p>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-semibold tabular-nums">{formatINR(price)}</span>
                        <span className="text-zinc-500 text-sm">/{billingCycle === 'yearly' ? 'year' : 'mo'}</span>
                      </div>
                      {/* Yearly savings line */}
                      {billingCycle === 'yearly' && plan.priceMonthly > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-xs text-zinc-600 line-through tabular-nums">
                            {formatINR(plan.priceMonthly * 12)}/year
                          </span>
                          {savings > 0 && (
                            <span className="text-xs font-medium text-emerald-400">
                              Save {savings}% annually
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Features list */}
                    {plan.features.length > 0 && (
                      <ul className="space-y-2.5 mb-6 flex-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* CTA button */}
                    {isCurrent ? (
                      <span className="text-center text-sm font-medium w-full py-2.5 rounded-md bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-default mt-auto">
                        Current Plan
                      </span>
                    ) : (
                      <button
                        onClick={() => (price === 0 ? openDowngradeModal(plan) : handleUpgrade(plan))}
                        disabled={isBusy || isLocked}
                        title={isLocked ? 'Payment verification in progress' : undefined}
                        className={`flex items-center justify-center gap-1.5 text-center text-sm font-medium w-full py-2.5 rounded-md transition-colors disabled:opacity-60 ${isLocked ? 'disabled:cursor-not-allowed' : 'disabled:cursor-wait'} mt-auto ${
                          isPopular
                            ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                            : 'bg-white text-zinc-950 hover:bg-zinc-200'
                        }`}
                      >
                        {isBusy ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Processing
                          </>
                        ) : (
                          price === 0 ? 'Switch to Free' : 'Upgrade'
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Payment History */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Payment History</h3>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4 text-center">No payment history</p>
        ) : (
          <div className="table-container">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const st = (p.status ?? '').toLowerCase();
                  return (
                    <tr key={p._id} className="table-row">
                      <td className="px-4 py-3 text-zinc-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium">{p.amount.toLocaleString()} {(p.currency ?? 'INR').toUpperCase()}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`badge ${st === 'success' ? 'badge-success' : st === 'failed' ? 'badge-error' : st === 'refunded' ? 'badge-info' : 'badge-warning'}`}>
                          {st}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Downgrade Confirmation Modal */}
      {downgradeOpen && downgradePlan && (
        <div role="dialog" aria-modal="true" aria-labelledby="downgrade-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={closeDowngradeModal}
          />

          {/* modal card */}
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0A0B] shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 overflow-hidden">
            {/* ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className={`absolute left-1/2 top-[-20%] h-[260px] w-[420px] -translate-x-1/2 rounded-full blur-[100px] transition-colors duration-300 ${
                  downgradeStep === 3 ? 'bg-red-500/[0.10]' : 'bg-amber-500/[0.10]'
                }`}
              />
            </div>

            <div className="relative p-6 sm:p-7">
              {/* progress + close */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3].map((step) => (
                    <span
                      key={step}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        step === downgradeStep
                          ? `w-6 ${downgradeStep === 3 ? 'bg-red-400' : 'bg-amber-400'}`
                          : step < downgradeStep
                          ? `w-1.5 ${downgradeStep === 3 ? 'bg-red-400/50' : 'bg-amber-400/50'}`
                          : 'w-1.5 bg-zinc-700'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-xs text-zinc-500 font-medium">Step {downgradeStep} of 3</span>
                </div>
                <button
                  onClick={closeDowngradeModal}
                  aria-label="Close"
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Step 1 — Warning */}
              {downgradeStep === 1 && (
                <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/20 flex items-center justify-center mb-4">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 id="downgrade-modal-title" className="text-lg font-semibold tracking-tight mb-2">
                    Downgrade to Free Plan?
                  </h3>
                  <p className="text-sm text-zinc-500 mb-5 leading-relaxed">
                    You're about to leave your paid plan. Before continuing, please review what this means.
                  </p>

                  <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-4 mb-6 space-y-3">
                    {[
                      'Premium features will no longer be available.',
                      'Free plan usage limits will apply.',
                      'Your current subscription benefits will be lost.',
                      "This action should only be taken if you're sure.",
                    ].map((line) => (
                      <div key={line} className="flex items-start gap-2.5">
                        <XCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-zinc-400 leading-relaxed">{line}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={closeDowngradeModal}
                      className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-colors"
                    >
                      Keep Current Plan
                    </button>
                    <button
                      onClick={() => setDowngradeStep(2)}
                      className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — Compare Plans */}
              {downgradeStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                  <h3 id="downgrade-modal-title" className="text-lg font-semibold tracking-tight mb-2">
                    Review Your Changes
                  </h3>
                  <p className="text-sm text-zinc-500 mb-5 leading-relaxed">
                    Here's a side-by-side look at what changes once you downgrade.
                  </p>

                  <div className="mb-6">
                    {/* current paid plan */}
                    <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.07] to-transparent p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Crown className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium text-zinc-200">
                          {planName} Plan <span className="text-zinc-500 font-normal">(current)</span>
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {['Current limits', 'Premium features', 'Advanced capabilities'].map((item) => (
                          <li key={item} className="flex items-center gap-2 text-sm text-zinc-400">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* divider */}
                    <div className="flex items-center justify-center py-2">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center">
                        <ArrowDown className="w-4 h-4 text-zinc-500" />
                      </div>
                    </div>

                    {/* free plan */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-4 h-4 rounded-full border border-zinc-600 shrink-0" />
                        <span className="text-sm font-medium text-zinc-200">Free Plan</span>
                      </div>
                      <ul className="space-y-2">
                        {['Reduced limits', 'Basic features only', 'Premium features removed', 'Lower usage limits'].map((item) => (
                          <li key={item} className="flex items-center gap-2 text-sm text-zinc-500">
                            <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setDowngradeStep(1)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={() => setDowngradeStep(3)}
                      className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — Final Confirmation */}
              {downgradeStep === 3 && (
                <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 ring-1 ring-red-400/20 flex items-center justify-center mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 id="downgrade-modal-title" className="text-lg font-semibold tracking-tight mb-2">
                    Final Confirmation
                  </h3>

                  <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 mb-5">
                    <p className="text-sm text-red-400 leading-relaxed font-medium">
                      You're about to downgrade to the Free plan. This will remove access to your premium subscription benefits.
                    </p>
                  </div>

                  <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={downgradeChecked}
                      onChange={(e) => setDowngradeChecked(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-zinc-600 bg-zinc-900 text-red-500 focus:ring-red-500/40 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm text-zinc-400 leading-relaxed">
                      I understand that I will lose my premium subscription benefits.
                    </span>
                  </label>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={closeDowngradeModal}
                      className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] transition-colors"
                    >
                      Keep Current Plan
                    </button>
                    <button
                      onClick={confirmDowngrade}
                      disabled={!downgradeChecked || upgradingPlanId === downgradePlan._id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {upgradingPlanId === downgradePlan._id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Processing
                        </>
                      ) : (
                        'Confirm Downgrade'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}