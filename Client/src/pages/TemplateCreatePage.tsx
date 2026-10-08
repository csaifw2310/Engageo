import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { templatesApi } from "../api/resources";
import { getApiErrorMessage } from "../hooks/useApiData";
import {
  detectTemplateVariables,
  INITIAL_CREATE_TEMPLATE_FORM,
  TEMPLATE_BUTTON_LIMITS,
  TEMPLATE_BUTTON_TYPE_LABELS,
} from "../types/template";
import type {
  CreateTemplateFieldErrors,
  CreateTemplateFormState,
  CreateTemplatePayload,
  CreateTemplateStep,
  TemplateButtonType,
} from "../types/template";
import { Stepper } from "../components/templates/create/Stepper";
import { StepBasicInfo } from "../components/templates/create/StepBasicInfo";
import { StepHeader } from "../components/templates/create/StepHeader";
import { StepBody } from "../components/templates/create/StepBody";
import { StepFooter } from "../components/templates/create/StepFooter";
import { StepButtons } from "../components/templates/create/StepButtons";
import { StepPreviewSubmit } from "../components/templates/create/StepPreviewSubmit";
import { CreateTemplateSuccess } from "../components/templates/create/CreateTemplateSuccess";

/**
 * Per-step field validation. Step 4 (Footer) has no required fields — it's
 * always valid. Step 6 (Preview & Submit) re-validates everything on submit
 * rather than on step-entry, since it's the final confirmation step.
 */
function validateStep(
  step: CreateTemplateStep,
  form: CreateTemplateFormState,
): CreateTemplateFieldErrors {
  const errors: CreateTemplateFieldErrors = {};

  if (step === 1) {
    if (!form.name.trim()) errors.name = "Template name is required.";
    if (!form.category) errors.category = "Category is required.";
    if (!form.language) errors.language = "Language is required.";
  }

  if (step === 2) {
    if (form.headerType === "TEXT" && !form.headerText.trim()) {
      errors.header = "Header text is required when the header type is Text.";
    }
    if (
      (form.headerType === "IMAGE" ||
        form.headerType === "VIDEO" ||
        form.headerType === "DOCUMENT") &&
      !form.headerMediaHandle
    ) {
      errors.header = form.headerMediaFileName
        ? `Waiting for the ${form.headerType.toLowerCase()} upload to finish (or fix the upload error) before continuing.`
        : `Select a file for the ${form.headerType.toLowerCase()} header, or change the header type to None.`;
    }
  }

  if (step === 3) {
    if (!form.bodyText.trim()) {
      errors.bodyText = "Body text is required.";
    } else {
      const { isSequential, firstGapAt } = detectTemplateVariables(
        form.bodyText,
      );
      if (!isSequential) {
        errors.bodyText = `Variable numbering must be sequential — expected {{${firstGapAt}}} next, with no gaps.`;
      }
    }
  }

  if (step === 5) {
    if (form.buttons.length > TEMPLATE_BUTTON_LIMITS.maxTotal) {
      errors.buttons = `Meta allows a maximum of ${TEMPLATE_BUTTON_LIMITS.maxTotal} buttons.`;
    } else {
      const counts = form.buttons.reduce<
        Partial<Record<TemplateButtonType, number>>
      >((acc, b) => {
        acc[b.type] = (acc[b.type] ?? 0) + 1;
        return acc;
      }, {});
      const overLimitEntry = (
        Object.entries(TEMPLATE_BUTTON_LIMITS.maxPerType) as [
          TemplateButtonType,
          number,
        ][]
      ).find(([type, max]) => (counts[type] ?? 0) > max);
      if (overLimitEntry) {
        errors.buttons = `Too many ${TEMPLATE_BUTTON_TYPE_LABELS[overLimitEntry[0]]} buttons for this template.`;
      } else {
        const incompleteButton = form.buttons.find((b) => {
          if (!b.text.trim()) return true;
          if (b.type === "URL" && !b.url?.trim()) return true;
          if (b.type === "PHONE_NUMBER" && !b.phoneNumber?.trim()) return true;
          if (b.type === "COPY_CODE" && !b.copyCode?.trim()) return true;
          return false;
        });
        if (incompleteButton)
          errors.buttons =
            "Fill in all required fields for each button, or remove it.";
      }
    }
  }

  return errors;
}

export function TemplateCreatePage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<CreateTemplateStep>(1);
  const [form, setForm] = useState<CreateTemplateFormState>(
    INITIAL_CREATE_TEMPLATE_FORM,
  );
  const [errors, setErrors] = useState<CreateTemplateFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Non-null once the create call has succeeded — swaps the wizard for the
  // success screen instead of redirecting away immediately.
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  const updateForm = (patch: Partial<CreateTemplateFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
    setSubmitError(null);
  };

  const goToStep = (target: CreateTemplateStep) => {
    setErrors({});
    setStep(target);
  };

  const goNext = () => {
    const stepErrors = validateStep(step, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    if (step < 6) setStep((step + 1) as CreateTemplateStep);
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as CreateTemplateStep);
  };

  const handleSubmit = async () => {
    const step1Errors = validateStep(1, form);
    const step2Errors = validateStep(2, form);
    const step3Errors = validateStep(3, form);
    const step5Errors = validateStep(5, form);
    const combined = {
      ...step1Errors,
      ...step2Errors,
      ...step3Errors,
      ...step5Errors,
    };

    if (Object.keys(combined).length > 0) {
      setErrors(combined);
      if (step1Errors.name || step1Errors.category || step1Errors.language)
        setStep(1);
      else if (step2Errors.header) setStep(2);
      else if (step3Errors.bodyText) setStep(3);
      else if (step5Errors.buttons) setStep(5);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      // headerType/headerText/headerMediaHandle/buttons/exampleValues are all
      // persisted by POST /templates now (see api/resources.ts and
      // types/template.ts) and actually submitted to Meta's Graph API.
      const payload: CreateTemplatePayload = {
        name: form.name,
        category: form.category,
        language: form.language,
        bodyText: form.bodyText,
        footerText: form.footerText || undefined,
        headerType: form.headerType,
        headerText: form.headerType === "TEXT" ? form.headerText : undefined,
        headerMediaHandle:
          form.headerType === "IMAGE" ||
          form.headerType === "VIDEO" ||
          form.headerType === "DOCUMENT"
            ? form.headerMediaHandle || undefined
            : undefined,

        headerMediaUrl:
          form.headerType === "IMAGE" ||
          form.headerType === "VIDEO" ||
          form.headerType === "DOCUMENT"
            ? form.headerMediaUrl || undefined
            : undefined,

        headerMediaPublicId:
          form.headerType === "IMAGE" ||
          form.headerType === "VIDEO" ||
          form.headerType === "DOCUMENT"
            ? form.headerMediaPublicId || undefined
            : undefined,
        buttons:
          form.buttons.length > 0
            ? form.buttons.map((b) => ({
                type: b.type,
                text: b.text,
                url: b.type === "URL" ? b.url : undefined,
                phoneNumber:
                  b.type === "PHONE_NUMBER" ? b.phoneNumber : undefined,
                copyCode: b.type === "COPY_CODE" ? b.copyCode : undefined,
              }))
            : undefined,
        exampleValues:
          Object.keys(form.exampleValues).length > 0
            ? Object.fromEntries(
                Object.entries(form.exampleValues).map(([k, v]) => [
                  String(k),
                  v,
                ]),
              )
            : undefined,
      };
      await templatesApi.create(payload);
      setSubmittedName(form.name);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAnother = () => {
    setForm(INITIAL_CREATE_TEMPLATE_FORM);
    setStep(1);
    setErrors({});
    setSubmitError(null);
    setSubmittedName(null);
  };

  if (submittedName !== null) {
    return (
      <div className="max-w-3xl mx-auto animate-in">
        <CreateTemplateSuccess
          templateName={submittedName}
          onReturnToTemplates={() => navigate("/templates")}
          onCreateAnother={handleCreateAnother}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Create Template</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Author a new WhatsApp message template.
          </p>
        </div>
        <button
          onClick={() => navigate("/templates")}
          className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="card p-5">
        <Stepper currentStep={step} onStepClick={goToStep} />
      </div>

      <div className="card p-6">
        {step === 1 && (
          <StepBasicInfo form={form} errors={errors} onChange={updateForm} />
        )}
        {step === 2 && (
          <StepHeader form={form} errors={errors} onChange={updateForm} />
        )}
        {step === 3 && (
          <StepBody form={form} errors={errors} onChange={updateForm} />
        )}
        {step === 4 && (
          <StepFooter form={form} errors={errors} onChange={updateForm} />
        )}
        {step === 5 && (
          <StepButtons form={form} errors={errors} onChange={updateForm} />
        )}
        {step === 6 && (
          <StepPreviewSubmit
            form={form}
            submitting={submitting}
            submitError={submitError}
            onSubmit={handleSubmit}
            onEditStep={goToStep}
          />
        )}
      </div>

      {step < 6 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            className="btn btn-secondary btn-sm disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            className="btn btn-primary btn-sm"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 6 && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={goBack}
            className="btn btn-secondary btn-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      )}
    </div>
  );
}
