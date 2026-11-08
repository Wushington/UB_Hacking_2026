"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  /** Shows a check mark (e.g. the current divider). */
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
};

/**
 * A small dropdown menu: a trigger button and a list of actions. Opens below the trigger, closes on
 * selection, Escape or an outside click, and supports ↑/↓ between items.
 */
export function Menu({
  label,
  trigger,
  items,
  heading,
  triggerClassName,
}: {
  /** Accessible name of the trigger button. */
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  heading?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLButtonElement>("[role^='menuitem']:not(:disabled)")?.focus();
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[role^='menuitem']:not(:disabled)") ?? [])];
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-[#9496bf] transition-colors hover:bg-[#1e1f45] hover:text-white focus-visible:ring-2 focus-visible:ring-[#ff5e7a] focus-visible:outline-none",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label={heading ?? label}
          className="absolute top-full right-0 z-30 mt-1.5 flex min-w-[200px] flex-col gap-0.5 rounded-[12px] border border-[#333564] bg-[#161730] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          {heading ? <p className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold tracking-[1.2px] text-[#9496bf] uppercase">{heading}</p> : null}
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemradio"}
              aria-checked={item.checked === undefined ? undefined : item.checked}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[#1e1f45] focus-visible:bg-[#1e1f45] focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent",
                item.danger ? "text-[#ff5e7a]" : "text-[#e8e6ff]",
              )}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                {item.checked ? <Check aria-hidden className="size-4 text-[#ff5e7a]" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
