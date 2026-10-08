import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Ban,
  FileText,
  Image as ImageIcon,
  Info,
  Loader2,
  Type,
  Upload,
  Video,
  X,
} from "lucide-react";
import type {
  CreateTemplateFieldErrors,
  CreateTemplateFormState,
  TemplateHeaderType,
} from "../../../types/template";
import { templatesApi } from "../../../api/resources";
import { getApiErrorMessage } from "../../../hooks/useApiData";

export interface StepHeaderProps {
  form: CreateTemplateFormState;
  errors: CreateTemplateFieldErrors;
  onChange: (patch: Partial<CreateTemplateFormState>) => void;
}

const MAX_HEADER_TEXT_LENGTH = 60;

const HEADER_OPTIONS: {
  type: TemplateHeaderType;
  label: string;
  icon: typeof Type;
}[] = [
  { type: "NONE", label: "None", icon: Ban },
  { type: "TEXT", label: "Text", icon: Type },
  { type: "IMAGE", label: "Image", icon: ImageIcon },
  { type: "VIDEO", label: "Video", icon: Video },
  { type: "DOCUMENT", label: "Document", icon: FileText },
];

const MEDIA_ACCEPT: Partial<Record<TemplateHeaderType, string>> = {
  IMAGE: "image/jpeg,image/png",
  VIDEO: "video/mp4,video/3gpp",
  DOCUMENT: "application/pdf",
};

const MEDIA_LIMITATION: Partial<Record<TemplateHeaderType, string>> = {
  IMAGE: "JPEG or PNG, up to 5MB.",
  VIDEO: "MP4 or 3GPP, up to 16MB.",
  DOCUMENT: "PDF only, up to 100MB.",
};

const LIMITATION_NOTE: Record<TemplateHeaderType, string> = {
  NONE: "Templates without a header still work fine — header is entirely optional.",
  TEXT: "Header text is limited to 60 characters and cannot include {{variables}}.",
  IMAGE: "Meta requires a JPEG or PNG under 5MB for image headers.",
  VIDEO: "Meta requires an MP4 or 3GPP file under 16MB for video headers.",
  DOCUMENT: "Meta requires a PDF under 100MB for document headers.",
};

export function StepHeader({ form, errors, onChange }: StepHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMediaHeader =
    form.headerType === "IMAGE" ||
    form.headerType === "VIDEO" ||
    form.headerType === "DOCUMENT";

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Object URL for the chosen file. Meta returns an opaque handle, never a
  // viewable URL, so previewing straight from the browser is the only way to
  // show the author what they picked. Lives on the form (not local state) so
  // the phone mock on the review step can render it too.
  const previewUrl = form.headerMediaPreviewUrl;

  const replacePreview = (file: File | null): string | null => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    return file ? URL.createObjectURL(file) : null;
  };


  const handleTypeChange = (type: TemplateHeaderType) => {
    setUploadError(null);
    onChange({
      headerType: type,
      headerText: "",
      headerMediaFileName: null,
      headerMediaHandle: null,
      headerMediaPreviewUrl: replacePreview(null),
    });
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so selecting the exact same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    onChange({
      headerMediaFileName: file.name,
      headerMediaHandle: null,
      headerMediaPreviewUrl: replacePreview(file),
    });
    setUploading(true);
    try {
      const result = await templatesApi.uploadHeaderMedia(
        file,
        form.headerType,
      );

      onChange({
        headerMediaFileName: file.name,
        headerMediaHandle: result.data.headerMediaHandle,
        headerMediaUrl: result.data.headerMediaUrl,
        headerMediaPublicId: result.data.headerMediaPublicId,
      });
    } catch (err) {
      setUploadError(getApiErrorMessage(err));
      onChange({
        headerMediaFileName: null,
        headerMediaHandle: null,
        headerMediaPreviewUrl: replacePreview(null),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadError(null);
    onChange({
      headerMediaFileName: null,
      headerMediaHandle: null,
      headerMediaPreviewUrl: replacePreview(null),
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-medium text-white">Header</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Optional. Shown above the message body.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-zinc-400">Header Type</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {HEADER_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = form.headerType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleTypeChange(opt.type)}
                className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-white text-zinc-950 border-white"
                    : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
                }`}
                aria-pressed={isActive}
              >
                <Icon className="w-4 h-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
        {errors.header && (
          <p className="text-xs text-red-400">{errors.header}</p>
        )}
      </div>

      {form.headerType === "TEXT" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="header-text" className="text-xs text-zinc-400">
              Header Text *
            </label>
            <span
              className={`text-[10px] tabular-nums ${
                form.headerText.length > MAX_HEADER_TEXT_LENGTH
                  ? "text-red-400"
                  : "text-zinc-600"
              }`}
            >
              {form.headerText.length} / {MAX_HEADER_TEXT_LENGTH}
            </span>
          </div>
          <input
            id="header-text"
            type="text"
            value={form.headerText}
            onChange={(e) =>
              onChange({
                headerText: e.target.value.slice(0, MAX_HEADER_TEXT_LENGTH),
              })
            }
            className="input"
            placeholder="Order Confirmed"
          />
        </div>
      )}

      {isMediaHeader && (
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400">
            {form.headerType === "IMAGE"
              ? "Image"
              : form.headerType === "VIDEO"
                ? "Video"
                : "Document"}{" "}
            File
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/50 transition-colors text-center disabled:opacity-60 disabled:cursor-wait"
          >
            {/* Show the actual file once picked. Meta only ever hands back an
                opaque handle, so this local object URL is the only way the
                author can confirm they chose the right asset. */}
            {previewUrl && form.headerType === "IMAGE" ? (
              <img
                src={previewUrl}
                alt={form.headerMediaFileName ?? "Header image"}
                className="max-h-40 rounded-lg object-contain"
              />
            ) : previewUrl && form.headerType === "VIDEO" ? (
              <video
                src={previewUrl}
                controls
                onClick={(e) => e.stopPropagation()}
                className="max-h-40 rounded-lg"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-zinc-500" />
                )}
              </div>
            )}
            {uploading ? (
              <p className="text-xs text-zinc-400">
                Uploading {form.headerMediaFileName}…
              </p>
            ) : form.headerMediaFileName ? (
              <p className="text-xs text-zinc-200 font-medium break-all px-4">
                {form.headerMediaFileName}
                {form.headerMediaHandle && (
                  <span className="text-emerald-400"> · Ready</span>
                )}
              </p>
            ) : (
              <>
                <p className="text-xs text-zinc-400">Click to select a file</p>
                <p className="text-[10px] text-zinc-600">
                  {MEDIA_LIMITATION[form.headerType]}
                </p>
              </>
            )}
          </button>
          {form.headerMediaFileName && !uploading && (
            <button
              type="button"
              onClick={handleRemoveFile}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
              Remove file
            </button>
          )}
          {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept={MEDIA_ACCEPT[form.headerType]}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      <div className="flex items-start gap-2 p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-600" />
        <p>{LIMITATION_NOTE[form.headerType]}</p>
      </div>
    </div>
  );
}
