import { TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABELS, TEMPLATE_LANGUAGES } from '../../../types/template';
import type { CreateTemplateFieldErrors, CreateTemplateFormState } from '../../../types/template';

export interface StepBasicInfoProps {
  form: CreateTemplateFormState;
  errors: CreateTemplateFieldErrors;
  onChange: (patch: Partial<CreateTemplateFormState>) => void;
}

export function StepBasicInfo({ form, errors, onChange }: StepBasicInfoProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-medium text-white">Basic Information</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Give your template a name, category, and language.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="template-name" className="text-xs text-zinc-400">
          Template Name * <span className="text-zinc-600">(lowercase, underscores only)</span>
        </label>
        <input
          id="template-name"
          type="text"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
          className={`input font-mono ${errors.name ? 'border-red-800 focus:border-red-700 focus:ring-red-900' : ''}`}
          placeholder="order_confirmation"
        />
        {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="template-category" className="text-xs text-zinc-400">
            Category *
          </label>
          <select
            id="template-category"
            value={form.category}
            onChange={(e) => onChange({ category: e.target.value as CreateTemplateFormState['category'] })}
            className="select w-full"
          >
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TEMPLATE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-red-400">{errors.category}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="template-language" className="text-xs text-zinc-400">
            Language *
          </label>
          <select
            id="template-language"
            value={form.language}
            onChange={(e) => onChange({ language: e.target.value })}
            className="select w-full"
          >
            {TEMPLATE_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          {errors.language && <p className="text-xs text-red-400">{errors.language}</p>}
        </div>
      </div>
    </div>
  );
}