import type { BadgeTone, TemplateCategory, TemplateStatus } from '../../types/template';
import { TEMPLATE_CATEGORY_LABELS, TEMPLATE_CATEGORY_TONE, TEMPLATE_STATUS_TONE } from '../../types/template';

const TONE_CLASS: Record<BadgeTone, string> = {
  default: 'badge-default',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-info',
};

const STATUS_LABEL: Record<TemplateStatus, string> = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
  PAUSED: 'Paused',
};

export function TemplateCategoryBadge({ category, className = '' }: { category: TemplateCategory; className?: string }) {
  return (
    <span className={`badge ${TONE_CLASS[TEMPLATE_CATEGORY_TONE[category]]} ${className}`}>
      {TEMPLATE_CATEGORY_LABELS[category]}
    </span>
  );
}

export function TemplateStatusBadge({ status, className = '' }: { status: TemplateStatus; className?: string }) {
  return (
    <span className={`badge ${TONE_CLASS[TEMPLATE_STATUS_TONE[status]]} ${className}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}