import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Clock, Eye, FileText, Layers, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { templatesApi } from '../api/resources';
import { useApiData, getApiErrorMessage } from '../hooks/useApiData';
import type { ApiTemplate, TemplateStatus, TemplateStatusFilter } from '../types/template';
import { TEMPLATE_STATUS_FILTERS, detectTemplateVariables, formatRelativeTime } from '../types/template';
import { TemplateCategoryBadge, TemplateStatusBadge } from '../components/templates/TemplateBadges';
import { TemplatePreviewPanel } from '../components/templates/TemplatePreviewPanel';

type ToastTone = 'success' | 'error';
interface ToastEntry {
  id: number;
  tone: ToastTone;
  message: string;
}

function CardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded bg-zinc-800" />
          <div className="h-5 w-16 rounded bg-zinc-800" />
        </div>
      </div>
      <div className="h-4 w-2/3 rounded bg-zinc-800 mb-2" />
      <div className="h-3 w-1/3 rounded bg-zinc-800 mb-4" />
      <div className="h-3 w-full rounded bg-zinc-800 mb-1.5" />
      <div className="h-3 w-4/5 rounded bg-zinc-800 mb-4" />
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
        <div className="h-3 w-20 rounded bg-zinc-800" />
        <div className="h-3 w-3 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const navigate = useNavigate();

  // Fetched unfiltered so status-tab counts (All / Approved / Pending / Rejected)
  // are always accurate regardless of which tab is currently active; the active
  // tab then filters this same list client-side.
  const { data: res, loading, error, refetch } = useApiData(
    () => templatesApi.list({ limit: 100 }),
    [],
  );
  const templates = res?.data?.templates ?? [];

  const [statusFilter, setStatusFilter] = useState<TemplateStatusFilter>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  // Overrides the "most recent syncedAt across templates" value the instant a
  // sync completes, so "Last synced" updates immediately without waiting on
  // the list refetch to land.
  const [manualSyncedAt, setManualSyncedAt] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  // Re-render periodically so "Last synced 2 minutes ago" keeps aging without
  // requiring another sync or navigation.
  const [, setClock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Automatically preview the first template once the list has loaded,
  // instead of leaving the preview panel on its empty state.
  useEffect(() => {
    if (!selectedId && templates.length > 0) {
      setSelectedId(templates[0]._id);
    }
  }, [templates, selectedId]);

  const pushToast = (tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const counts: Record<TemplateStatusFilter, number> = useMemo(
    () => ({
      '': templates.length,
      approved: templates.filter((t) => t.status === 'APPROVED').length,
      pending: templates.filter((t) => t.status === 'PENDING').length,
      rejected: templates.filter((t) => t.status === 'REJECTED').length,
      paused: templates.filter((t) => t.status === 'PAUSED').length,
    }),
    [templates],
  );

  const filteredTemplates = useMemo(() => {
    if (!statusFilter) return templates;
    const target = statusFilter.toUpperCase() as TemplateStatus;
    return templates.filter((t) => t.status === target);
  }, [templates, statusFilter]);

  const selectedTemplate: ApiTemplate | null = useMemo(
    () => templates.find((t) => t._id === selectedId) ?? null,
    [templates, selectedId],
  );

  const mostRecentSyncedAt = useMemo(() => {
    const timestamps = templates.map((t) => t.syncedAt).filter((s): s is string => Boolean(s));
    if (timestamps.length === 0) return null;
    return timestamps.reduce((latest, ts) => (new Date(ts) > new Date(latest) ? ts : latest));
  }, [templates]);

  const lastSyncedAt = manualSyncedAt ?? mostRecentSyncedAt;
  const lastSyncedLabel = formatRelativeTime(lastSyncedAt);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await templatesApi.sync();
      const { created = 0, updated = 0, total = 0, syncedAt } = r.data ?? {};
      setManualSyncedAt(syncedAt ?? new Date().toISOString());
      pushToast(
        'success',
        `Templates synced successfully — ${total} total, ${created} created, ${updated} updated. Last synced just now.`,
      );
      refetch();
    } catch (err) {
      pushToast('error', getApiErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Templates</h1>
          <p className="text-sm text-zinc-500">Manage and sync your WhatsApp templates from Meta.</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-end gap-1">
            <button onClick={handleSync} disabled={syncing} className="btn btn-secondary btn-sm">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? 'Syncing…' : 'Sync From Meta'}
            </button>
            {lastSyncedLabel && <span className="text-[10px] text-zinc-600">Last synced {lastSyncedLabel}</span>}
          </div>
          <button onClick={() => navigate('/templates/create')} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>
      </div>

      {/* Status filters — underline tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800">
        {TEMPLATE_STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors duration-200 ${
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f.label}
              <span className={`text-[10px] tabular-nums ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {counts[f.key]}
              </span>
              <span
                className={`absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-emerald-500 transition-all duration-200 origin-center ${
                  isActive ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="empty-state-title">No templates yet</p>
              <p className="empty-state-description">Create a template or sync from your WhatsApp Business account.</p>
              <div className="flex gap-2 mt-4">
                <button onClick={handleSync} disabled={syncing} className="btn btn-secondary btn-sm">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing ? 'Syncing…' : 'Sync From Meta'}
                </button>
                <button onClick={() => navigate('/templates/create')} className="btn btn-primary btn-sm">
                  <Plus className="w-4 h-4" />
                  Create Template
                </button>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="empty-state-title">No templates with this status</p>
              <p className="empty-state-description">Try a different filter.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.map((t) => {
                const isSelected = t._id === selectedId;
                const bodyPreview = t.bodyText || 'No body text';
                const variableCount = detectTemplateVariables(t.bodyText).variables.length;
                const createdLabel = new Date(t.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });
                const syncedLabel = formatRelativeTime(t.syncedAt);

                return (
                  <button
                    key={t._id}
                    onClick={() => setSelectedId(t._id)}
                    className={`relative text-left p-5 flex flex-col rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? 'bg-zinc-900/80 border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-[0_8px_24px_-10px_rgba(16,185,129,0.45)]'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <Check className="w-3 h-3 text-zinc-950" />
                      </span>
                    )}

                    <div className="flex items-start justify-between mb-4 pr-6">
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-zinc-500" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <TemplateCategoryBadge category={t.category} />
                        <TemplateStatusBadge status={t.status} />
                      </div>
                    </div>
                    <h3 className="font-medium mb-1 truncate">{t.name}</h3>
                    {t.language && <p className="text-xs text-zinc-600 mb-2">Lang: {t.language}</p>}
                    <p className="text-sm text-zinc-500 line-clamp-3 flex-1 mb-4">{bodyPreview}</p>

                    <div className="pt-4 border-t border-zinc-800 flex items-start justify-between gap-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {createdLabel}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            {variableCount} {variableCount === 1 ? 'Variable' : 'Variables'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600">
                          {syncedLabel ? `Synced ${syncedLabel}` : 'Not synced yet'}
                        </p>
                      </div>
                      <Eye className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" aria-label="Preview" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <TemplatePreviewPanel template={selectedTemplate} />
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 p-3 pr-2 rounded-lg text-sm shadow-2xl border animate-in ${
              t.tone === 'error'
                ? 'bg-red-950/90 border-red-900/60 text-red-300'
                : 'bg-emerald-950/90 border-emerald-900/60 text-emerald-300'
            }`}
          >
            {t.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} className="p-0.5 rounded hover:bg-white/10 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}