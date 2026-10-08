import { useState } from 'react';
import {
  Users, DollarSign, TrendingUp, Activity, FileText, CreditCard, Send,
  CheckCircle, Search, UserX, UserCheck, Plus, X, Check, Loader2, AlertCircle,
} from 'lucide-react';
import { adminApi, type AdminUser, type AdminPlan, type AdminSubscription, type AdminPayment } from '../api/services';
import { useApiData, getApiErrorMessage } from '../hooks/useApiData';

const UNLIMITED = -1;
const limitLabel = (n: number) => (n === UNLIMITED ? 'Unlimited' : (n ?? 0).toLocaleString());

// ── Shared helpers ─────────────────────────────────────────────────────────────
function LoadingState() {
  return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400">
      <AlertCircle className="w-5 h-5 shrink-0" /><p className="text-sm">{msg}</p>
    </div>
  );
}

// ── Admin Overview ─────────────────────────────────────────────────────────────
export function AdminOverview() {
  const { data: res, loading, error } = useApiData(() => adminApi.getDashboard(), []);

  const d = res?.data;
  const fmt = (n?: number) => n != null ? n.toLocaleString() : '—';
  const fmtMoney = (n?: number) => n != null ? `₹${n.toLocaleString()}` : '—';

  const stats = d ? [
    { title: 'Total Users', value: fmt(d.totalUsers), icon: Users },
    { title: 'Active Users', value: fmt(d.activeUsers), icon: Activity },
    { title: 'Suspended Users', value: fmt(d.suspendedUsers), icon: Users },
    { title: 'Paid Users', value: fmt(d.paidUsers), icon: CheckCircle },
    { title: 'Free Users', value: fmt(d.freeUsers), icon: Users },
    { title: 'Total Revenue', value: fmtMoney(d.totalRevenue), icon: DollarSign },
    { title: 'Total Campaigns', value: fmt(d.totalCampaigns), icon: Send },
    { title: 'Total Messages', value: fmt(d.totalMessages), icon: TrendingUp },
  ] : [];

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-medium">Dashboard</h1>
        <p className="text-sm text-zinc-500">Platform overview</p>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState msg={error} /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.title} className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className="w-5 h-5 text-zinc-500" />
                </div>
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-xs text-zinc-500 mt-1">{stat.title}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-5 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <h3 className="text-sm font-medium mb-6">This Month</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'New Users', value: fmt(d?.usersThisMonth) },
                  { label: 'Campaigns', value: fmt(d?.campaignsThisMonth) },
                  { label: 'Messages', value: fmt(d?.messagesThisMonth) },
                  { label: 'Revenue', value: fmtMoney(d?.revenueThisMonth) },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-lg bg-zinc-800/30">
                    <p className="text-xl font-semibold">{item.value}</p>
                    <p className="text-xs text-zinc-500 mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <h3 className="text-sm font-medium mb-6">Key Metrics</h3>
              <div className="space-y-4">
                {[
                  { label: 'Active Subscriptions', value: fmt(d?.activeSubscriptions) },
                  { label: 'Cancelled Subscriptions', value: fmt(d?.cancelledSubscriptions) },
                  { label: 'Paid Users', value: fmt(d?.paidUsers) },
                  { label: 'Total Revenue', value: fmtMoney(d?.totalRevenue) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30">
                    <span className="text-xs text-zinc-500">{item.label}</span>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Admin Users ────────────────────────────────────────────────────────────────
export function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: res, loading, error, refetch } = useApiData(
    () => adminApi.getUsers({ page, limit: 20, search: search || undefined }),
    [page, search],
  );

  const users: AdminUser[] = res?.users ?? [];
  const totalPages = res?.totalPages ?? 1;
  const totalUsers = res?.totalUsers ?? 0;

  const handleSuspend = async (id: string) => {
    try { await adminApi.suspendUser(id); refetch(); } catch { /* silent */ }
  };

  const handleActivate = async (id: string) => {
    try { await adminApi.activateUser(id); refetch(); } catch { /* silent */ }
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-medium">Users</h1>
        <p className="text-sm text-zinc-500">{totalUsers} registered users</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input pl-9"
          />
        </div>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState msg={error} /> : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users className="w-6 h-6 text-zinc-600" /></div>
          <p className="empty-state-title">No users found</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden lg:table-cell">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="avatar avatar-sm">{u.name.charAt(0)}</div>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-zinc-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="badge badge-default capitalize">{u.currentPlan ?? 'Free'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.status === 'active' ? 'badge-success' : u.status === 'suspended' ? 'badge-error' : 'badge-warning'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.status === 'active' ? (
                          <button onClick={() => handleSuspend(u.id)} title="Suspend" className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors">
                            <UserX className="w-4 h-4 text-zinc-500" />
                          </button>
                        ) : (
                          <button onClick={() => handleActivate(u.id)} title="Activate" className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors">
                            <UserCheck className="w-4 h-4 text-zinc-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-zinc-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Admin Plans ────────────────────────────────────────────────────────────────
export function AdminPlansPage() {
  const { data: res, loading, error, refetch } = useApiData(() => adminApi.getPlans(), []);
  const plans: AdminPlan[] = res?.plans ?? [];

  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [form, setForm] = useState({
    name: '', priceMonthly: 0, priceYearly: 0, maxContacts: 1000,
    maxCampaignsPerMonth: 10, maxMessagesPerMonth: 1000, features: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ name: '', priceMonthly: 0, priceYearly: 0, maxContacts: 1000, maxCampaignsPerMonth: 10, maxMessagesPerMonth: 1000, features: '' });
    setShowModal(true);
  };

  const openEdit = (plan: AdminPlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      maxContacts: plan.maxContacts,
      maxCampaignsPerMonth: plan.maxCampaignsPerMonth,
      maxMessagesPerMonth: plan.maxMessagesPerMonth,
      features: (plan.features ?? []).join(', '),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        name: form.name,
        priceMonthly: Number(form.priceMonthly),
        priceYearly: Number(form.priceYearly),
        maxContacts: Number(form.maxContacts),
        maxCampaignsPerMonth: Number(form.maxCampaignsPerMonth),
        maxMessagesPerMonth: Number(form.maxMessagesPerMonth),
        features: form.features.split(',').map(f => f.trim()).filter(Boolean),
      };
      if (editingPlan) {
        await adminApi.updatePlan(editingPlan._id, payload);
      } else {
        await adminApi.createPlan(payload);
      }
      setShowModal(false);
      refetch();
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this plan?')) return;
    try { await adminApi.deletePlan(id); refetch(); } catch { /* silent */ }
  };

  const numberFields: { label: string; key: keyof typeof form }[] = [
    { label: 'Monthly Price (₹)', key: 'priceMonthly' },
    { label: 'Yearly Price (₹)', key: 'priceYearly' },
    { label: 'Max Contacts (-1 = unlimited)', key: 'maxContacts' },
    { label: 'Max Campaigns / Month (-1 = unlimited)', key: 'maxCampaignsPerMonth' },
    { label: 'Max Messages / Month (-1 = unlimited)', key: 'maxMessagesPerMonth' },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Plans</h1>
          <p className="text-sm text-zinc-500">Manage subscription plans</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" />Create Plan
        </button>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState msg={error} /> : plans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText className="w-6 h-6 text-zinc-600" /></div>
          <p className="empty-state-title">No plans yet</p>
          <p className="empty-state-description">Create subscription plans for your users.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan._id} className="card-hover p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-medium">{plan.name}</h3>
                  <p className="text-2xl font-semibold mt-1">₹{plan.priceMonthly}<span className="text-sm font-normal text-zinc-500">/mo</span></p>
                </div>
                <span className={`badge ${plan.isActive ? 'badge-success' : 'badge-default'}`}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-zinc-500 mb-4">
                <p>{limitLabel(plan.maxMessagesPerMonth)} messages / mo</p>
                <p>{limitLabel(plan.maxContacts)} contacts</p>
                <p>{limitLabel(plan.maxCampaignsPerMonth)} campaigns / mo</p>
              </div>
              <div className="flex gap-2 pt-4 border-t border-zinc-800">
                <button onClick={() => openEdit(plan)} className="btn btn-secondary btn-sm flex-1">Edit</button>
                <button onClick={() => handleDelete(plan._id)} className="btn btn-secondary btn-sm text-red-400">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="modal p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium">{editingPlan ? 'Edit Plan' : 'Create Plan'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-zinc-800 rounded-md"><X className="w-5 h-5 text-zinc-500" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {saveError && <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400">{saveError}</div>}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
              </div>
              {numberFields.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-xs text-zinc-400">{f.label} *</label>
                  <input
                    type="number"
                    value={form[f.key] as number}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Features (comma separated)</label>
                <textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} className="input min-h-20 resize-none" placeholder="Feature 1, Feature 2" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Subscriptions ────────────────────────────────────────────────────────
export function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1);
  const { data: res, loading, error, refetch } = useApiData(
    () => adminApi.getSubscriptions({ page, limit: 20 }), [page],
  );
  const subs: AdminSubscription[] = res?.subscriptions ?? [];
  const totalPages = res?.totalPages ?? 1;
  const totalSubscriptions = res?.totalSubscriptions ?? 0;

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this subscription?')) return;
    try { await adminApi.cancelSubscription(id); refetch(); } catch { /* silent */ }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'ACTIVE': return 'badge-success';
      case 'EXPIRED': return 'badge-error';
      case 'CANCELLED': return 'badge-default';
      case 'PENDING': return 'badge-info';
      default: return 'badge-default';
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-medium">Subscriptions</h1>
        <p className="text-sm text-zinc-500">{totalSubscriptions} subscriptions</p>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState msg={error} /> : subs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CreditCard className="w-6 h-6 text-zinc-600" /></div>
          <p className="empty-state-title">No subscriptions yet</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">Expires</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((sub) => (
                  <tr key={sub._id} className="table-row">
                    <td className="px-4 py-3">
                      <p className="font-medium">{sub.userId?.name ?? '—'}</p>
                      <p className="text-xs text-zinc-500">{sub.userId?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-default">{sub.planId?.name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusBadge(sub.status)}`}>{sub.status?.toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">
                      {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {sub.status === 'ACTIVE' && (
                        <button onClick={() => handleCancel(sub._id)} className="btn btn-secondary btn-sm text-red-400">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-zinc-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Admin Payments ─────────────────────────────────────────────────────────────
export function AdminPaymentsPage() {
  const [page, setPage] = useState(1);
  const { data: res, loading, error } = useApiData(
    () => adminApi.getPayments({ page, limit: 20 }), [page],
  );
  const payments: AdminPayment[] = res?.payments ?? [];
  const totalPages = res?.totalPages ?? 1;
  const totalPayments = res?.totalPayments ?? 0;

  const statusBadge = (s: string) => {
    switch (s) {
      case 'SUCCESS': return 'badge-success';
      case 'FAILED': return 'badge-error';
      case 'PENDING': return 'badge-warning';
      case 'REFUNDED': return 'badge-info';
      default: return 'badge-default';
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-medium">Payments</h1>
        <p className="text-sm text-zinc-500">{totalPayments} transactions</p>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState msg={error} /> : payments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><DollarSign className="w-6 h-6 text-zinc-600" /></div>
          <p className="empty-state-title">No payments yet</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="table-row">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.userId?.name ?? '—'}</p>
                      <p className="text-xs text-zinc-500">{p.userId?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {p.amount.toLocaleString()} {(p.currency ?? 'INR').toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusBadge(p.status)}`}>{p.status?.toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-zinc-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Admin Analytics ────────────────────────────────────────────────────────────
export function AdminAnalyticsPage() {
  const { data: res, loading, error } = useApiData(() => adminApi.getAnalytics(), []);
  const analytics = res?.data as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-medium">Analytics</h1>
        <p className="text-sm text-zinc-500">Platform-wide metrics</p>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState msg={error} /> : !analytics ? (
        <div className="empty-state">
          <p className="empty-state-title">No analytics data</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(analytics).map(([key, val]) => (
            typeof val !== 'object' && (
              <div key={key} className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <p className="text-2xl font-semibold">{typeof val === 'number' ? val.toLocaleString() : String(val)}</p>
                <p className="text-xs text-zinc-500 mt-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
