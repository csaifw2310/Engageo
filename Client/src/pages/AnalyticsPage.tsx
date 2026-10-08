import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid,
} from 'recharts';
import { TrendingUp, Send, Eye, CheckCircle, XCircle, Users, Megaphone, Loader2, AlertCircle } from 'lucide-react';
import { analyticsApi } from '../api/services';
import { useApiData } from '../hooks/useApiData';

export function AnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  const { data: dashRes, loading: dashLoading, error: dashError } = useApiData(
    () => analyticsApi.getDashboard(), [],
  );
  const { data: trendsRes, loading: trendsLoading } = useApiData(
    () => analyticsApi.getTrends({ range: period }), [period],
  );

  const dash = dashRes?.data;
  const trends = trendsRes?.data ?? [];
  const fmt = (n?: number) => n != null ? n.toLocaleString() : '—';
  const pct = (n?: number) => n != null ? `${n.toFixed(1)}%` : '—';

  const stats = dash ? [
    { label: 'Total Messages', value: fmt(dash.totalMessages), icon: Send, color: 'text-blue-400' },
    { label: 'Total Campaigns', value: fmt(dash.totalCampaigns), icon: Megaphone, color: 'text-violet-400' },
    { label: 'Delivery Rate', value: pct(dash.deliveryRate), icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Read Rate', value: pct(dash.readRate), icon: Eye, color: 'text-blue-400' },
    { label: 'Failure Rate', value: pct(dash.failureRate), icon: XCircle, color: 'text-red-400' },
    { label: 'Total Contacts', value: fmt(dash.totalContacts), icon: Users, color: 'text-amber-400' },
  ] : [];

  const tooltipStyle = {
    backgroundColor: 'var(--tooltip-bg, #18181b)',
    border: '1px solid var(--tooltip-border, #27272a)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--tooltip-color, #fafafa)',
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Analytics</h1>
          <p className="text-sm text-zinc-500">Detailed performance insights</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value as '7d' | '30d' | '90d')} className="select">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {dashLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : dashError ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" /><p className="text-sm">{dashError}</p>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <TrendingUp className="w-3 h-3 text-zinc-600" />
                </div>
                <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Delivery breakdown cards */}
          {dash && (
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Sent', value: fmt(dash.totalSent), pct: null, color: 'bg-blue-500' },
                { label: 'Delivered', value: fmt(dash.totalDelivered), pct: pct(dash.deliveryRate), color: 'bg-emerald-500' },
                { label: 'Read', value: fmt(dash.totalRead), pct: pct(dash.readRate), color: 'bg-indigo-500' },
              ].map(item => (
                <div key={item.label} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-zinc-500 font-medium">{item.label}</span>
                    {item.pct && <span className="text-xs font-medium text-emerald-400">{item.pct}</span>}
                  </div>
                  <p className="text-2xl font-semibold mb-3">{item.value}</p>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: item.pct || '100%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trends chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium">Message Trends</h3>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-white inline-block rounded" />Sent</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-emerald-400 inline-block rounded" />Delivered</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-blue-400 inline-block rounded" />Read</span>
              </div>
            </div>
            {trendsLoading ? (
              <div className="flex items-center justify-center h-56"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
            ) : trends.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-zinc-600 gap-2">
                <Megaphone className="w-8 h-8 opacity-30" />
                <p className="text-sm">No trend data for this period</p>
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fff" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="deliveredGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" stroke="#52525e" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525e" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="messages" stroke="#fff" strokeWidth={1.5} fillOpacity={1} fill="url(#sentGrad)" name="Sent" />
                    <Area type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={1.5} fill="url(#deliveredGrad)" name="Delivered" />
                    <Area type="monotone" dataKey="read" stroke="#3b82f6" strokeWidth={1.5} fill="none" name="Read" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Daily volume bar chart */}
          <div className="card p-5">
            <h3 className="text-sm font-medium mb-5">Daily Volume</h3>
            {trendsLoading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
            ) : trends.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-zinc-600">No data available</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" stroke="#52525e" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525e" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="messages" fill="#3f3f46" radius={[3, 3, 0, 0]} name="Messages" />
                    <Bar dataKey="delivered" fill="#22c55e" radius={[3, 3, 0, 0]} name="Delivered" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Summary table */}
          {dash && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h3 className="text-sm font-medium">Summary</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {[
                  { label: 'Total Contacts', value: fmt(dash.totalContacts) },
                  { label: 'Total Groups', value: fmt(dash.totalGroups) },
                  { label: 'Total Campaigns', value: fmt(dash.totalCampaigns) },
                  { label: 'Total Messages', value: fmt(dash.totalMessages) },
                  { label: 'Messages Sent', value: fmt(dash.totalSent) },
                  { label: 'Messages Delivered', value: fmt(dash.totalDelivered) },
                  { label: 'Messages Read', value: fmt(dash.totalRead) },
                  { label: 'Messages Failed', value: fmt(dash.totalFailed) },
                  { label: 'Delivery Rate', value: pct(dash.deliveryRate) },
                  { label: 'Read Rate', value: pct(dash.readRate) },
                  { label: 'Failure Rate', value: pct(dash.failureRate) },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-zinc-500">{row.label}</span>
                    <span className="text-sm font-medium tabular-nums">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
