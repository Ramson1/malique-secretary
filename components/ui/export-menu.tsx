"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { downloadReport, type ExportFilters, type ExportFormat } from "@/lib/export";
import { useToast } from "@/components/ui/toast";

export type { ExportFormat } from "@/lib/export";

export interface ExportOption {
  format: ExportFormat;
  label?: string;
  href?: string;
}

const iconFor: Record<ExportFormat, typeof FileText> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  docx: FileType,
};

const defaultLabel: Record<ExportFormat, string> = {
  pdf: "PDF (.pdf)",
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  docx: "Word (.docx)",
};

const FORMATS: ExportFormat[] = ["pdf", "xlsx", "docx", "csv"];

export interface ExportMenuProps {
  /** Legacy: explicit per-format hrefs (kept for backward compatibility). */
  options?: ExportOption[];
  /** Preferred: server report kind, e.g. "pos-sales" | "inventory" | ... */
  kind?: string;
  /** Current on-screen filter state so the file matches the view. */
  filters?: ExportFilters;
  /** Restrict offered formats (default: pdf, xlsx, docx, csv). */
  formats?: ExportFormat[];
  /** Optional override for the download action (e.g. bulk-selected ids). Resolves to the downloaded filename. */
  onPick?: (format: ExportFormat) => Promise<string | void>;
  disabled?: boolean;
  className?: string;
}

export function ExportMenu({
  options,
  kind,
  filters,
  formats,
  onPick,
  disabled,
  className = "",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Normalize into a list of items regardless of which prop style is used.
  const items: ExportOption[] = kind ? (formats ?? FORMATS).map((format) => ({ format })) : options ?? [];

  if (!items.length) return null;

  async function pick(format: ExportFormat) {
    setOpen(false);
    if (!kind && !onPick) return;
    setBusy(format);
    try {
      const filename = onPick
        ? await onPick(format)
        : await downloadReport(kind!, format, filters ?? {});
      if (filename) toast.success(`${filename} downloaded.`);
    } catch (e: any) {
      toast.error(e?.message || "Export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {busy ? "Preparing…" : "Export"}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-fade-in">
          {items.map((opt) => {
            const Icon = iconFor[opt.format];
            // Legacy href mode keeps a plain download link; kind mode uses fetch+blob.
            if (opt.href) {
              return (
                <a
                  key={opt.format}
                  href={opt.href}
                  download
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-navy-800 transition-colors hover:bg-slate-50"
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  {opt.label ?? defaultLabel[opt.format]}
                </a>
              );
            }
            return (
              <button
                key={opt.format}
                type="button"
                onClick={() => pick(opt.format)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-navy-800 transition-colors hover:bg-slate-50"
              >
                <Icon className="h-4 w-4 text-slate-400" />
                {opt.label ?? defaultLabel[opt.format]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
