"use client";

import { Info, Lightbulb, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { orbitEyebrowClass } from "@/components/orbit/shell";

const STEPS = [
  { title: "Capture the important parts", body: "Read the board and pull out what matters." },
  { title: "Put ideas in order", body: "Group key concepts, definitions and examples." },
  { title: "Make it yours", body: "File your notes under a subject and turn them into flashcards when you’re ready." },
];

/** "How it works" button on the Capture page, opening the help popup. */
export function CaptureHelpButton() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#1e1f45] px-4 text-[13px] text-[#c1bedf] transition-colors hover:bg-[#2a2b5a] hover:text-white focus-visible:ring-2 focus-visible:ring-[#ff5e7a] focus-visible:outline-none"
      >
        <Info aria-hidden className="size-4 text-[#ff5e7a]" />
        How it works
      </button>
      {open ? (
        <CaptureHelpDialog
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus(); // give focus back to what opened it
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Modal popup over a darkened page. Closes with the ✕ button, "Got it", Escape, or a click on the
 * backdrop. Focus moves into the popup and Tab stays inside it while it's open.
 */
export function CaptureHelpDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden"; // the page behind doesn't scroll
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      data-testid="help-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05061a]/75 p-4 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col gap-5 overflow-y-auto rounded-[22px] bg-[#161730] p-6 text-white shadow-[0_24px_64px_rgba(0,0,0,0.5)] sm:p-8"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full text-[#c1bedf] transition-colors hover:bg-[#1e1f45] hover:text-white focus-visible:ring-2 focus-visible:ring-[#ff5e7a] focus-visible:outline-none"
        >
          <X aria-hidden className="size-5" />
        </button>

        <p className={orbitEyebrowClass}>A LITTLE HELP FROM AI</p>
        <h2 id={titleId} className="pr-8 text-[24px] leading-[1.3] font-medium tracking-[-0.5px] sm:text-[26px]">
          Less transcribing. More understanding.
        </h2>
        <p className="text-[14px] leading-[1.6] text-[#9496bf]">Your photos become one clear set of notes, saved under the subject you choose.</p>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3.5">
              <span className="text-[12px] leading-[1.6] text-[#ff5e7a]">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex flex-col gap-1">
                <p className="text-[14px] text-white">{step.title}</p>
                <p className="text-[12px] leading-[1.5] text-[#9496bf]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 rounded-[14px] bg-[#0b0c22] p-4">
          <div className="flex items-center gap-2.5">
            <Lightbulb aria-hidden className="size-[18px] text-[#ff5e7a]" strokeWidth={1.75} />
            <h3 className="text-[14px] font-medium">A clearer source, a better start</h3>
          </div>
          <p className="text-[13px] leading-[1.6] text-[#c1bedf]">
            Keep the whole board in frame, avoid glare, and add photos in the order they were written.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center justify-center self-end rounded-[10px] bg-[#ff5e7a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#ff7891] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}
