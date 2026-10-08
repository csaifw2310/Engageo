import { Users, Send, CheckCircle, TrendingUp, Loader2, AlertCircle, Megaphone } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { analyticsApi } from '../api/services';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../store/AppStore';

export function Dashboard() {
  const { user } = useAuth();

  const { data: dashRes, loading: dashLoading, error: dashError } = useApiData(
    () => analyticsApi.getDashboard(), [],
  );
  const { data: trendsRes } = useApiData(
    () => analyticsApi.getTrends({ range: '7d' }), [],
  );

  const dash = dashRes?.data;
  const trends = trendsRes?.data ?? [];

  const fmt = (n?: number) => n != null ? n.toLocaleString() : '—';
  const pct = (n?: number) => n != null ? `${n.toFixed(1)}%` : '—';

  const stats = dash ? [
    { title: 'Contacts', value: fmt(dash.totalContacts), icon: Users },
    { title: 'Messages Sent', value: fmt(dash.totalSent), icon: Send },
    { title: 'Delivery Rate', value: pct(dash.deliveryRate), icon: CheckCircle },
    { title: 'Total Campaigns', value: fmt(dash.totalCampaigns), icon: TrendingUp },
  ] : [];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Welcome back{user?.name ? `, ${user.name}` : ''}. Here&apos;s your overview.</p>
        </div>
      </div>

      {dashLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : dashError ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" /><p className="text-sm">{dashError}</p>
        </div>
      ) : (
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
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium">Messages</h3>
                <span className="text-xs text-zinc-500">Last 7 days</span>
              </div>
              {trends.length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="text-center">
                    <Megaphone className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm text-zinc-600">No message data yet</p>
                    <p className="text-xs text-zinc-700">Send your first campaign to see trends</p>
                  </div>
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends}>
                      <defs>
                        <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fff" stopOpacity={0.1} />
                          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="messages" stroke="#fff" strokeWidth={1.5} fillOpacity={1} fill="url(#msgGradient)" name="Sent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <h3 className="text-sm font-medium mb-6">Key Metrics</h3>
              <div className="space-y-4">
                {[
                  { label: 'Read Rate', value: pct(dash?.readRate) },
                  { label: 'Failure Rate', value: pct(dash?.failureRate) },
                  { label: 'Total Messages', value: fmt(dash?.totalMessages) },
                  { label: 'Total Contacts', value: fmt(dash?.totalContacts) },
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
