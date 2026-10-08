import { CheckCircle2, Clock, FileText, Plus } from 'lucide-react';

export interface CreateTemplateSuccessProps {
  /** Name of the template that was just submitted, shown for confirmation. */
  templateName: string;
  onReturnToTemplates: () => void;
  onCreateAnother: () => void;
}

export function CreateTemplateSuccess({ templateName, onReturnToTemplates, onCreateAnother }: CreateTemplateSuccessProps) {
  return (
    <div className="card p-10 flex flex-col items-center text-center max-w-lg mx-auto animate-in">
      <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-5">
        <CheckCircle2 className="w-7 h-7 text-emerald-400" />
      </div>

      <h2 className="text-lg font-medium text-white">Template Submitted Successfully</h2>
      {templateName && (
        <p className="text-sm text-zinc-500 mt-1 font-mono">{templateName}</p>
      )}

      <span className="badge badge-warning inline-flex items-center gap-1.5 mt-4">
        <Clock className="w-3 h-3" />
        Pending Review
      </span>

      <p className="text-sm text-zinc-500 mt-4 max-w-sm">
        Your template has been submitted to Meta. Approval usually takes a few minutes.
      </p>

      <div className="flex items-center gap-2 mt-7">
        <button type="button" onClick={onReturnToTemplates} className="btn btn-secondary btn-sm">
          <FileText className="w-4 h-4" />
          Return to Templates
        </button>
        <button type="button" onClick={onCreateAnother} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          Create Another Template
        </button>
      </div>
    </div>
  );
}