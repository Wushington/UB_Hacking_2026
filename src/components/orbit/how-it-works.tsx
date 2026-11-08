"use client";

import { Info, Lightbulb } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Modal } from "@/components/orbit/modal";

type Tip = { title: string; body: string };

/** "How It Works" button opening a short numbered explanation of the page. */
export function HowItWorks({ steps, tip }: { steps: string[]; tip?: Tip }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  function close() {
    setOpen(false);
    buttonRef.current?.focus(); // give focus back to what opened it
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#1e1f45] px-4 text-[13px] text-[#c1bedf] transition-colors hover:bg-[#2a2b5a] hover:text-white"
      >
        <Info aria-hidden className="size-4 text-[#ff5e7a]" />
        How It Works
      </button>
      {open ? (
        <Modal onClose={close} labelledBy={titleId} className="max-w-[480px] gap-5 p-6 sm:p-8">
          <h2 id={titleId} className="pr-8 text-[24px] leading-[1.3] font-medium tracking-[-0.5px]">
            How It Works
          </h2>
          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <li key={step} className="flex items-baseline gap-3 text-[14px] leading-[1.5] text-white">
                <span className="text-[13px] font-semibold text-[#ff8da1]">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {tip ? (
            <div className="flex flex-col gap-2 rounded-[14px] bg-[#0b0c22] p-4">
              <div className="flex items-center gap-2.5">
                <Lightbulb aria-hidden className="size-[18px] text-[#ff5e7a]" strokeWidth={1.75} />
                <h3 className="text-[14px] font-medium">{tip.title}</h3>
              </div>
              <p className="text-[13px] leading-[1.6] text-[#c1bedf]">{tip.body}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="inline-flex h-11 items-center justify-center self-end rounded-[10px] bg-[#ff5e7a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#ff7891]"
          >
            Got It
          </button>
        </Modal>
      ) : null}
    </>
  );
}
