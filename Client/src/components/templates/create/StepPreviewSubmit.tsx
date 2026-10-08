import type { ReactNode } from 'react';
import { AlertCircle, Check, Loader2, Pencil } from 'lucide-react';
import { detectTemplateVariables } from '../../../types/template';
import type { CreateTemplateFormState, CreateTemplateStep, TemplateButton } from '../../../types/template';
import { TEMPLATE_BUTTON_TYPE_LABELS, TEMPLATE_LANGUAGES } from '../../../types/template';
import { TemplateCategoryBadge } from '../TemplateBadges';
import { TemplatePhonePreview } from '../TemplatePhonePreview';

export interface StepPreviewSubmitProps {
  form: CreateTemplateFormState;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onEditStep: (step: CreateTemplateStep) => void;
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-zinc-600 mb-0.5">{label}</p>
        <div className="text-sm text-zinc-200 break-words">{value}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white shrink-0 mt-4"
      >
        <Pencil className="w-3 h-3" />
        Edit
      </button>
    </div>
  );
}

/**
 * Substitutes {{n}} tokens in the body with their Step 3 example value, so the
 * live preview shows realistic content instead of raw placeholders. Falls
 * back to the token itself when no example value was entered for that index.
 */
function buildPreviewBody(bodyText: string, exampleValues: Record<number, string>): string {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, idxStr) => {
    const value = exampleValues[parseInt(idxStr, 10)];
    return value && value.trim() ? value : match;
  });
}

function headerSummary(form: CreateTemplateFormState): ReactNode {
  if (form.headerType === 'NONE') return <span className="text-zinc-600">None</span>;
  if (form.headerType === 'TEXT') {
    return form.headerText || <span className="text-zinc-600">Text (empty)</span>;
  }
  const typeLabel = form.headerType.charAt(0) + form.headerType.slice(1).toLowerCase();
  return form.headerMediaFileName ? (
    <span className="font-mono text-xs">{form.headerMediaFileName}</span>
  ) : (
    <span className="text-zinc-600">{typeLabel} (no file selected)</span>
  );
}

export function StepPreviewSubmit({ form, submitting, submitError, onSubmit, onEditStep }: StepPreviewSubmitProps) {
  const { variables } = detectTemplateVariables(form.bodyText);
  const languageLabel = TEMPLATE_LANGUAGES.find((l) => l.value === form.language)?.label ?? form.language;
  const previewBody = buildPreviewBody(form.bodyText, form.exampleValues);
  const previewButtons: TemplateButton[] = form.buttons.map((b) => ({
    type: b.type,
    text: b.text || 'Button',
    url: b.url,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-medium text-white">Preview & Submit</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Review how this template will look, then send it for approval.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex justify-center md:justify-start">
          <TemplatePhonePreview
            headerType={form.headerType}
            headerText={form.headerText}
            headerMediaLabel={form.headerMediaFileName ?? undefined}
            headerMediaPreviewUrl={form.headerMediaPreviewUrl}
            bodyText={previewBody}
            footerText={form.footerText}
            buttons={previewButtons}
          />
        </div>

        <div className="divide-y divide-zinc-800/70 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4">
          <SummaryRow label="Template Name" value={<span className="font-mono">{form.name || '—'}</span>} onEdit={() => onEditStep(1)} />
          <SummaryRow
            label="Category"
            value={<TemplateCategoryBadge category={form.category} />}
            onEdit={() => onEditStep(1)}
          />
          <SummaryRow label="Language" value={languageLabel} onEdit={() => onEditStep(1)} />
          <SummaryRow label="Header" value={headerSummary(form)} onEdit={() => onEditStep(2)} />
          <SummaryRow
            label="Body"
            value={<p className="whitespace-pre-wrap line-clamp-4">{form.bodyText || '—'}</p>}
            onEdit={() => onEditStep(3)}
          />
          <SummaryRow label="Variables" value={variables.length} onEdit={() => onEditStep(3)} />
          <SummaryRow label="Footer" value={form.footerText || <span className="text-zinc-600">None</span>} onEdit={() => onEditStep(4)} />
          <SummaryRow
            label="Buttons"
            value={
              form.buttons.length === 0 ? (
                <span className="text-zinc-600">None</span>
              ) : (
                <ul className="space-y-0.5">
                  {form.buttons.map((b) => (
                    <li key={b.id} className="text-xs">
                      <span className="text-zinc-500">{TEMPLATE_BUTTON_TYPE_LABELS[b.type]}:</span> {b.text || '—'}
                    </li>
                  ))}
                </ul>
              )
            }
            onEdit={() => onEditStep(5)}
          />
        </div>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-red-950/50 border border-red-900/50 text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50">
        <p className="text-xs text-zinc-500">Template will be saved as pending and submitted to Meta for review.</p>
        <button type="button" onClick={onSubmit} disabled={submitting} className="btn btn-primary btn-sm shrink-0">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Submit for Review
        </button>
      </div>
    </div>
  );
}