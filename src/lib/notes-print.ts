const PRINT_CSS = `
@page { size: A4; margin: 18mm 16mm 20mm; @bottom-left { content: "Orbit Study"; font: 9pt Arial; color: #666; } @bottom-right { content: counter(page); font: 9pt Arial; color: #666; } }
html, body { background: white !important; color: #172033 !important; font: 11pt/1.65 Arial, sans-serif; margin: 0; }
body { padding: 28px; }
.export-help { background: #fff1f3; padding: 12px 18px; margin-bottom: 24px; font: 13px/1.5 Arial; color: #582735; }
.export-brand { color: #c43c58; font: bold 10pt Arial; letter-spacing: 2px; margin-bottom: 12px; }
.export-title { font: bold 26pt/1.2 Arial; color: #172033; margin: 0 0 10px; overflow-wrap: anywhere; }
.export-subject { color: #666; font: 11pt Arial; margin: 0 0 26px; padding-bottom: 18px; border-bottom: 2px solid #ff5e7a; }
.export-notes, .export-notes div { display: block !important; width: auto !important; max-width: 100% !important; }
.export-notes * { color: #172033 !important; background: transparent !important; box-shadow: none !important; text-shadow: none !important; }
.export-notes section { display: block !important; padding: 0 !important; margin: 0 0 24px !important; overflow: visible !important; border-radius: 0 !important; }
.export-notes h2 { font: bold 16pt/1.3 Arial !important; margin: 18px 0 12px; break-after: avoid; }
.export-notes p { margin: 7px 0; }
.export-notes ul, .export-notes ol { display: block !important; padding-left: 24px; margin: 8px 0; }
.export-notes ul { list-style: disc; } .export-notes ol { list-style: decimal; }
.export-notes li { margin: 5px 0; } .export-notes li p { margin: 0; }
.export-notes pre, .export-notes code { white-space: pre-wrap; overflow-wrap: anywhere; }
.export-notes a { color: #a52b47 !important; text-decoration: underline; }
.export-notes .katex-display { overflow: visible !important; margin: 14px 0; break-inside: avoid; }
.export-notes .katex-html { white-space: normal; }
.export-notes table { width: 100%; border-collapse: collapse; } .export-notes td, .export-notes th { border: 1px solid #ccc; padding: 6px; }
@media print { body { padding: 0; } .export-help { display: none; } }
`;

/** Clone already-sanitized rendered notes; never interpolate note text into HTML. */
export function prepareNotesPrint(document: Document, source: HTMLElement, title: string, subject?: string | null) {
  document.title = title.trim() || "Orbit Study notes";
  document.documentElement.className = "";
  const style = document.createElement("style");
  style.textContent = PRINT_CSS;
  document.head.append(style);
  const help = document.createElement("p");
  help.className = "export-help";
  help.textContent = 'Choose “Save as PDF” in the print dialog. You can also use your browser’s Print command to reopen it.';
  const article = document.createElement("article");
  const brand = document.createElement("p");
  brand.className = "export-brand";
  brand.textContent = "ORBIT STUDY / NOTES";
  const heading = document.createElement("h1");
  heading.className = "export-title";
  heading.textContent = title;
  const subtitle = document.createElement("p");
  subtitle.className = "export-subject";
  subtitle.textContent = subject || "Study notes";
  const notes = document.createElement("div");
  notes.className = "export-notes";
  notes.append(document.importNode(source, true));
  article.append(brand, heading, subtitle, notes);
  document.body.replaceChildren(help, article);
}