"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Modal popup over a darkened page. Closes with the ✕ button, Escape, or a click on the backdrop.
 * Focus moves to the ✕ button, Tab stays inside, the page behind doesn't scroll. The opener should
 * give focus back to whatever opened it in `onClose`.
 */
export function Modal({
  onClose,
  labelledBy,
  label,
  className,
  closeClassName,
  children,
}: {
  onClose: () => void;
  /** id of the visible title, or use `label`. */
  labelledBy?: string;
  label?: string;
  className?: string;
  closeClassName?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")].filter(
        (el) => !(el as HTMLButtonElement).disabled,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) return;
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
  }, []);

  return createPortal(
    <div
      data-testid="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05061a]/75 p-4 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        className={cn(
          "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-y-auto rounded-[22px] bg-[#161730] text-white shadow-[0_24px_64px_rgba(0,0,0,0.5)]",
          className,
        )}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn(
            "absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full text-[#c1bedf] transition-colors hover:bg-[#1e1f45] hover:text-white focus-visible:ring-2 focus-visible:ring-[#ff5e7a] focus-visible:outline-none",
            closeClassName,
          )}
        >
          <X aria-hidden className="size-5" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
