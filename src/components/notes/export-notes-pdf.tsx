"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";
import { prepareNotesPrint } from "@/lib/notes-print";

export function ExportNotesPdf({ title, subject }: { title: string; subject?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function exportPdf() {
    setError("");
    const source = document.getElementById("orbit-notes-content");
    if (!source) { setError("Notes are not ready to export. Please refresh and try again."); return; }
    const preview = window.open("", "_blank");
    if (!preview) { setError("Allow pop-ups for Orbit Study, then try Export PDF again."); return; }
    preview.opener = null;
    setBusy(true);
    try {
      // Keep the existing KaTeX font and layout rules in the export.
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
      const loaded: Promise<void>[] = [];
      for (const original of styles) {
        const copy = original.cloneNode(true) as HTMLElement;
        if (copy instanceof HTMLLinkElement) {
          loaded.push(new Promise((resolve) => {
            copy.onload = () => resolve();
            copy.onerror = () => resolve();
          }));
        }
        preview.document.head.append(copy);
      }
      prepareNotesPrint(preview.document, source, title, subject);
      await Promise.race([
        Promise.all(loaded).then(() => preview.document.fonts.ready),
        new Promise(resolve => window.setTimeout(resolve, 10000)),
      ]);
      if (!preview.closed) { preview.focus(); preview.print(); }
    } catch {
      setError("Couldn’t open the PDF preview. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={() => void exportPdf()} disabled={busy} title="Open a print-ready copy and choose Save as PDF" className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#333564] bg-[#1e1f45] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2a2b5a] disabled:opacity-50">
        <FileDown size={16} aria-hidden="true" />{busy ? "Preparing PDF…" : "Export PDF"}
      </button>
      {error && <p role="alert" className="max-w-xs text-xs text-[#ffb4c1]">{error}</p>}
    </div>
  );
}