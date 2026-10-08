import { Check } from 'lucide-react';
import { CREATE_TEMPLATE_STEPS } from '../../../types/template';
import type { CreateTemplateStep } from '../../../types/template';

export interface StepperProps {
  currentStep: CreateTemplateStep;
  /** Only called for steps strictly before currentStep — you can't skip ahead by clicking. */
  onStepClick: (step: CreateTemplateStep) => void;
}

export function Stepper({ currentStep, onStepClick }: StepperProps) {
  return (
    <div>
      {/* Full stepper — sm and up */}
      <ol className="hidden sm:flex items-start">
        {CREATE_TEMPLATE_STEPS.map((s, i) => {
          const isComplete = s.step < currentStep;
          const isCurrent = s.step === currentStep;
          const isLast = i === CREATE_TEMPLATE_STEPS.length - 1;

          return (
            <li key={s.step} className={`flex items-start ${isLast ? '' : 'flex-1'}`}>
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={!isComplete}
                  onClick={() => isComplete && onStepClick(s.step)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border transition-colors shrink-0 ${
                    isCurrent
                      ? 'bg-white text-zinc-950 border-white'
                      : isComplete
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25 cursor-pointer'
                        : 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-default'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : s.step}
                </button>
                <div className="mt-2 text-center max-w-[110px]">
                  <p className={`text-xs font-medium ${isCurrent ? 'text-white' : isComplete ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {s.title}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{s.description}</p>
                </div>
              </div>
              {!isLast && (
                <div className={`flex-1 h-px mt-4 mx-2 ${s.step < currentStep ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />
              )}
            </li>
          );
        })}
      </ol>

      {/* Compact stepper — below sm */}
      <div className="sm:hidden flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">
            Step {currentStep} of {CREATE_TEMPLATE_STEPS.length}
          </p>
          <p className="text-sm font-medium text-white mt-0.5">
            {CREATE_TEMPLATE_STEPS.find((s) => s.step === currentStep)?.title}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {CREATE_TEMPLATE_STEPS.map((s) => (
            <span
              key={s.step}
              className={`w-1.5 h-1.5 rounded-full ${
                s.step === currentStep ? 'bg-white' : s.step < currentStep ? 'bg-emerald-500' : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}