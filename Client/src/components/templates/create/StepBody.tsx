import { AlertTriangle, Check } from 'lucide-react';
import { detectTemplateVariables } from '../../../types/template';
import type { CreateTemplateFieldErrors, CreateTemplateFormState } from '../../../types/template';

export interface StepBodyProps {
  form: CreateTemplateFormState;
  errors: CreateTemplateFieldErrors;
  onChange: (patch: Partial<CreateTemplateFormState>) => void;
}

const MAX_BODY_LENGTH = 1024;

export function StepBody({ form, errors, onChange }: StepBodyProps) {
  const { variables, isSequential, firstGapAt } = detectTemplateVariables(form.bodyText);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-medium text-white">Body</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Write your message. Use <span className="font-mono text-zinc-400">{'{{1}}'}</span>,{' '}
          <span className="font-mono text-zinc-400">{'{{2}}'}</span> and so on for variables.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="template-body" className="text-xs text-zinc-400">
            Body Text *
          </label>
          <span className={`text-[10px] tabular-nums ${form.bodyText.length > MAX_BODY_LENGTH ? 'text-red-400' : 'text-zinc-600'}`}>
            {form.bodyText.length} / {MAX_BODY_LENGTH}
          </span>
        </div>
        <textarea
          id="template-body"
          value={form.bodyText}
          onChange={(e) => onChange({ bodyText: e.target.value })}
          className={`input min-h-40 resize-y font-mono text-[13px] leading-relaxed ${
            errors.bodyText ? 'border-red-800 focus:border-red-700 focus:ring-red-900' : ''
          }`}
          placeholder={'Hi {{1}}, your order {{2}} has been confirmed and will arrive by {{3}}.'}
        />
        {errors.bodyText && <p className="text-xs text-red-400">{errors.bodyText}</p>}
      </div>

      {/* Detected variables */}
      <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-2.5">
        <p className="text-xs font-medium text-zinc-400">Detected variables</p>
        {variables.length === 0 ? (
          <p className="text-xs text-zinc-600">
            No variables yet — add <span className="font-mono">{'{{1}}'}</span> to your body text to personalize this template.
          </p>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {variables.map((v) => (
              <span
                key={v.index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-900/40"
              >
                {v.token}
              </span>
            ))}
          </div>
        )}

        {variables.length > 0 && (
          <div
            className={`flex items-start gap-2 text-xs pt-1 ${isSequential ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {isSequential ? (
              <>
                <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Variables are numbered sequentially — looks good.</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Variable numbering has a gap — expected <span className="font-mono">{`{{${firstGapAt}}}`}</span> next.
                  Variables must run {'{{1}}'}, {'{{2}}'}, {'{{3}}'}… with no skipped numbers.
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Example values — one input per detected variable, feeds the live phone preview on the final step */}
      {variables.length > 0 && (
        <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-3">
          <div>
            <p className="text-xs font-medium text-zinc-400">Example Values</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              Sample values for each variable — used in the Meta review preview and to drive the live phone preview.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {variables.map((v) => (
              <div key={v.index} className="space-y-1">
                <label htmlFor={`example-value-${v.index}`} className="text-[11px] font-mono text-zinc-500">
                  {v.token} Example Value
                </label>
                <input
                  id={`example-value-${v.index}`}
                  type="text"
                  value={form.exampleValues[v.index] ?? ''}
                  onChange={(e) =>
                    onChange({ exampleValues: { ...form.exampleValues, [v.index]: e.target.value } })
                  }
                  className="input"
                  placeholder={v.index === 1 ? 'John' : v.index === 2 ? 'Order #12345' : `Value ${v.index}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}