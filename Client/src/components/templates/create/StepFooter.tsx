import { Info } from 'lucide-react';
import type { CreateTemplateFieldErrors, CreateTemplateFormState } from '../../../types/template';

export interface StepFooterProps {
  form: CreateTemplateFormState;
  errors: CreateTemplateFieldErrors;
  onChange: (patch: Partial<CreateTemplateFormState>) => void;
}

const MAX_FOOTER_LENGTH = 60;

export function StepFooter({ form, onChange }: StepFooterProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-medium text-white">Footer</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Optional. A short line shown in gray beneath the message body.</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="template-footer" className="text-xs text-zinc-400">
            Footer Text <span className="text-zinc-600">(optional)</span>
          </label>
          <span
            className={`text-[10px] tabular-nums ${
              form.footerText.length > MAX_FOOTER_LENGTH ? 'text-red-400' : 'text-zinc-600'
            }`}
          >
            {form.footerText.length} / {MAX_FOOTER_LENGTH}
          </span>
        </div>
        <input
          id="template-footer"
          type="text"
          value={form.footerText}
          onChange={(e) => onChange({ footerText: e.target.value.slice(0, MAX_FOOTER_LENGTH) })}
          className="input"
          placeholder="Reply STOP to unsubscribe"
        />
      </div>

      <div className="flex items-start gap-2 p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-600" />
        <p>
          Footers can't contain variables — this text is shown exactly as written, the same for every recipient.
          Common uses are opt-out instructions or a brand tagline.
        </p>
      </div>
    </div>
  );
}