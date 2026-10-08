import { AlertCircle, Check, Copy, ExternalLink, Phone, Plus, Trash2 } from 'lucide-react';
import {
  TEMPLATE_BUTTON_LIMITS,
  TEMPLATE_BUTTON_TYPES,
  TEMPLATE_BUTTON_TYPE_LABELS,
} from '../../../types/template';
import type {
  CreateTemplateButtonDraft,
  CreateTemplateFieldErrors,
  CreateTemplateFormState,
  TemplateButtonType,
} from '../../../types/template';

export interface StepButtonsProps {
  form: CreateTemplateFormState;
  errors: CreateTemplateFieldErrors;
  onChange: (patch: Partial<CreateTemplateFormState>) => void;
}

const MAX_BUTTON_TEXT_LENGTH = 25;

const BUTTON_TYPE_ICON: Record<TemplateButtonType, typeof Check> = {
  QUICK_REPLY: Check,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
};

function makeButtonId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `btn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function StepButtons({ form, errors, onChange }: StepButtonsProps) {
  const { buttons } = form;

  const countsByType = buttons.reduce<Partial<Record<TemplateButtonType, number>>>((acc, b) => {
    acc[b.type] = (acc[b.type] ?? 0) + 1;
    return acc;
  }, {});

  const violations: string[] = [];
  if (buttons.length > TEMPLATE_BUTTON_LIMITS.maxTotal) {
    violations.push(`Meta allows a maximum of ${TEMPLATE_BUTTON_LIMITS.maxTotal} buttons — you have ${buttons.length}.`);
  }
  (Object.entries(TEMPLATE_BUTTON_LIMITS.maxPerType) as [TemplateButtonType, number][]).forEach(([type, max]) => {
    const count = countsByType[type] ?? 0;
    if (count > max) {
      violations.push(
        `Only ${max} ${TEMPLATE_BUTTON_TYPE_LABELS[type]} button${max === 1 ? '' : 's'} allowed — you have ${count}.`,
      );
    }
  });

  const updateButton = (id: string, patch: Partial<CreateTemplateButtonDraft>) => {
    onChange({ buttons: buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  };

  const removeButton = (id: string) => {
    onChange({ buttons: buttons.filter((b) => b.id !== id) });
  };

  const addButton = () => {
    if (buttons.length >= TEMPLATE_BUTTON_LIMITS.maxTotal) return;
    const newButton: CreateTemplateButtonDraft = { id: makeButtonId(), type: 'QUICK_REPLY', text: '' };
    onChange({ buttons: [...buttons, newButton] });
  };

  const atMax = buttons.length >= TEMPLATE_BUTTON_LIMITS.maxTotal;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-white">Buttons</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Optional. Add quick replies or call-to-action buttons.</p>
        </div>
        <span className="text-[11px] text-zinc-600 tabular-nums shrink-0 mt-1">
          {buttons.length} / {TEMPLATE_BUTTON_LIMITS.maxTotal} buttons
        </span>
      </div>

      {errors.buttons && <p className="text-xs text-red-400">{errors.buttons}</p>}

      {buttons.length === 0 ? (
        <div className="p-6 rounded-lg border border-dashed border-zinc-800 text-center">
          <p className="text-xs text-zinc-500">No buttons yet. Buttons are optional — add one if you'd like recipients to be able to tap a reply or action.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {buttons.map((btn, i) => {
            const Icon = BUTTON_TYPE_ICON[btn.type];
            return (
              <div key={btn.id} className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Icon className="w-3.5 h-3.5" />
                    Button {i + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeButton(btn.id)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor={`button-type-${btn.id}`} className="text-[11px] text-zinc-500">
                      Type
                    </label>
                    <select
                      id={`button-type-${btn.id}`}
                      value={btn.type}
                      onChange={(e) => updateButton(btn.id, { type: e.target.value as TemplateButtonType })}
                      className="select w-full"
                    >
                      {TEMPLATE_BUTTON_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TEMPLATE_BUTTON_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`button-text-${btn.id}`} className="text-[11px] text-zinc-500">
                        Button Text
                      </label>
                      <span
                        className={`text-[10px] tabular-nums ${
                          btn.text.length > MAX_BUTTON_TEXT_LENGTH ? 'text-red-400' : 'text-zinc-600'
                        }`}
                      >
                        {btn.text.length} / {MAX_BUTTON_TEXT_LENGTH}
                      </span>
                    </div>
                    <input
                      id={`button-text-${btn.id}`}
                      type="text"
                      value={btn.text}
                      onChange={(e) => updateButton(btn.id, { text: e.target.value.slice(0, MAX_BUTTON_TEXT_LENGTH) })}
                      className="input"
                      placeholder={
                        btn.type === 'QUICK_REPLY'
                          ? 'Yes, I confirm'
                          : btn.type === 'URL'
                            ? 'Visit Website'
                            : btn.type === 'PHONE_NUMBER'
                              ? 'Call Us'
                              : 'Copy Code'
                      }
                    />
                  </div>
                </div>

                {btn.type === 'URL' && (
                  <div className="space-y-1.5">
                    <label htmlFor={`button-url-${btn.id}`} className="text-[11px] text-zinc-500">
                      Website URL
                    </label>
                    <input
                      id={`button-url-${btn.id}`}
                      type="url"
                      value={btn.url ?? ''}
                      onChange={(e) => updateButton(btn.id, { url: e.target.value })}
                      className="input font-mono text-[13px]"
                      placeholder="https://example.com/orders/{{1}}"
                    />
                  </div>
                )}

                {btn.type === 'PHONE_NUMBER' && (
                  <div className="space-y-1.5">
                    <label htmlFor={`button-phone-${btn.id}`} className="text-[11px] text-zinc-500">
                      Phone Number
                    </label>
                    <input
                      id={`button-phone-${btn.id}`}
                      type="tel"
                      value={btn.phoneNumber ?? ''}
                      onChange={(e) => updateButton(btn.id, { phoneNumber: e.target.value })}
                      className="input font-mono text-[13px]"
                      placeholder="+1 555 000 1234"
                    />
                  </div>
                )}

                {btn.type === 'COPY_CODE' && (
                  <div className="space-y-1.5">
                    <label htmlFor={`button-code-${btn.id}`} className="text-[11px] text-zinc-500">
                      Code To Copy
                    </label>
                    <input
                      id={`button-code-${btn.id}`}
                      type="text"
                      value={btn.copyCode ?? ''}
                      onChange={(e) => updateButton(btn.id, { copyCode: e.target.value })}
                      className="input font-mono text-[13px]"
                      placeholder="SUMMER25"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {violations.length > 0 && (
        <div className="p-3.5 rounded-lg border border-red-900/50 bg-red-950/30 space-y-1.5">
          {violations.map((v) => (
            <div key={v} className="flex items-start gap-2 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addButton}
        disabled={atMax}
        className="btn btn-secondary btn-sm disabled:opacity-40 disabled:pointer-events-none"
      >
        <Plus className="w-4 h-4" />
        Add Button
      </button>

      <div className="flex items-start gap-2 p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-600" />
        <p>
          Meta caps templates at {TEMPLATE_BUTTON_LIMITS.maxTotal} buttons total, with up to{' '}
          {TEMPLATE_BUTTON_LIMITS.maxPerType.URL} Visit Website, {TEMPLATE_BUTTON_LIMITS.maxPerType.PHONE_NUMBER} Phone
          Number, and {TEMPLATE_BUTTON_LIMITS.maxPerType.COPY_CODE} Copy Code button. Quick Reply buttons have no
          separate cap beyond the total.
        </p>
      </div>
    </div>
  );
}