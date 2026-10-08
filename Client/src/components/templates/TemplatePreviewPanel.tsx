import type { ReactNode } from 'react';
import { AlertTriangle, Calendar, Hash, Layers, MessageSquareDashed, MousePointerClick, RefreshCw, Tag, Type } from 'lucide-react';
import type { ApiTemplate, TemplateHeaderType } from '../../types/template';
import { detectTemplateVariables, formatRelativeTime } from '../../types/template';
import { TemplateCategoryBadge, TemplateStatusBadge } from './TemplateBadges';
import { TemplatePhonePreview } from './TemplatePhonePreview';

export interface TemplatePreviewPanelProps {
  template: ApiTemplate | null;
  className?: string;
}

const HEADER_TYPE_LABELS: Record<TemplateHeaderType, string> = {
  NONE: 'None',
  TEXT: 'Text',
  IMAGE: 'Image',
  VIDEO: 'Video',
  DOCUMENT: 'Document',
};

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {label}
      </div>
      <div className="text-xs text-zinc-200 font-medium text-right break-all">{value}</div>
    </div>
  );
}

export function TemplatePreviewPanel({ template, className = '' }: TemplatePreviewPanelProps) {
  if (!template) {
    return (
      <div className={`card p-6 sticky top-6 ${className}`}>
        <div className="empty-state py-10">
          <div className="empty-state-icon">
            <MessageSquareDashed className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="empty-state-title">No template selected</p>
          <p className="empty-state-description">Click a template card to preview it here.</p>
        </div>
      </div>
    );
  }

  const { variables } = detectTemplateVariables(template.bodyText);
  const syncedLabel = formatRelativeTime(template.syncedAt);
  const isRejected = template.status === 'REJECTED';

  return (
    <div className={`card p-5 sticky top-6 space-y-5 ${className}`}>
      <TemplatePhonePreview
        headerType={template.headerType}
        headerMediaPreviewUrl={template.headerMediaUrl}
        bodyText={template.bodyText}
        footerText={template.footerText}
        buttons={template.buttons}
      />

      <div className="pt-1 border-t border-zinc-800">
        <h3 className="text-sm font-medium text-white mt-4 mb-1">{template.name}</h3>
        <div className="flex items-center gap-2">
          <TemplateCategoryBadge category={template.category} />
          <TemplateStatusBadge status={template.status} />
        </div>
      </div>

      {/* Rejection reason isn't on the backend document yet (template.model.js
          has no such field) — this only renders when a future backend
          response actually populates it, so nothing here is fabricated. */}
      {isRejected && template.rejectionReason && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-red-900/50 bg-red-950/30">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
          <div>
            <p className="text-xs font-medium text-red-400">Rejected</p>
            <p className="text-xs text-red-300/90 mt-1 leading-relaxed">{template.rejectionReason}</p>
          </div>
        </div>
      )}

      <div className="divide-y divide-zinc-800/70 -mt-1">
        <DetailRow icon={Tag} label="Language" value={template.language || '—'} />
        <DetailRow icon={Type} label="Header Type" value={HEADER_TYPE_LABELS[template.headerType]} />
        <DetailRow icon={Layers} label="Variables" value={variables.length} />
        <DetailRow icon={MousePointerClick} label="Buttons" value={template.buttons.length} />
        <DetailRow
          icon={Calendar}
          label="Created"
          value={new Date(template.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        />
        <DetailRow icon={RefreshCw} label="Last Synced" value={syncedLabel ?? 'Not synced yet'} />
        <DetailRow icon={Hash} label="Meta Template ID" value={template.metaTemplateId || 'Not synced yet'} />
      </div>
    </div>
  );
}