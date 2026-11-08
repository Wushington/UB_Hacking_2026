"use client";

import { ChevronLeft, ChevronRight, ImageOff, Maximize2 } from "lucide-react";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/orbit/modal";
import { orbitCardClass, orbitEyebrowClass } from "@/components/orbit/shell";
import { cn } from "@/lib/utils";

/**
 * The original photos next to the notes, so students can compare what the AI read with what they
 * wrote. Desktop: a sticky panel beside the notes. Phones: the panel sits above the notes, and a
 * "Photo N" tag opens the full-screen view instead.
 */

export type NotePhoto = { id: string; url: string };

type Viewer = {
  photos: NotePhoto[];
  selected: number;
  /** Show photo `index` (from a "Photo N" tag): in the panel on desktop, full screen on phones. */
  show: (index: number) => void;
};

const ViewerContext = createContext<Viewer | null>(null);

/** Matches the lg breakpoint where the panel sits beside the notes. */
const isDesktop = () => typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches === true;

export function NotesWithPhotos({ photos, children }: { photos: NotePhoto[]; children: ReactNode }) {
  const [selected, setSelected] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [flash, setFlash] = useState(0);
  const panelRef = useRef<HTMLElement>(null);

  if (!photos.length) return <>{children}</>;

  const show = (index: number) => {
    setSelected(index);
    if (isDesktop()) {
      setFlash((n) => n + 1); // briefly highlight the panel so the change is noticed
      panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      setFullScreen(true);
    }
  };

  return (
    <ViewerContext.Provider value={{ photos, selected, show }}>
      <div className="grid w-full grid-cols-1 items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:gap-6">
        <div className="order-2 min-w-0 lg:order-1">{children}</div>
        <PhotoPanel
          ref={panelRef}
          photos={photos}
          selected={selected}
          onSelect={setSelected}
          onExpand={() => setFullScreen(true)}
          flash={flash}
        />
      </div>
      {fullScreen ? (
        <PhotoLightbox photos={photos} index={selected} onIndexChange={setSelected} onClose={() => setFullScreen(false)} />
      ) : null}
    </ViewerContext.Provider>
  );
}

/** "Photo 2" tags under a note block, for the photos it was read from. */
export function SourceTags({ imageIds }: { imageIds: string[] }) {
  const viewer = useContext(ViewerContext);
  if (!viewer || !imageIds.length) return null;
  const indexes = imageIds.map((id) => viewer.photos.findIndex((p) => p.id === id)).filter((i) => i >= 0);
  if (!indexes.length) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {indexes.map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => viewer.show(i)}
          aria-label={`Show photo ${i + 1}, where this note came from`}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide transition-colors",
            viewer.selected === i ? "bg-[#ff5e7a]/20 text-[#ff8da1]" : "bg-[#1e1f45] text-[#9496bf] hover:text-white",
          )}
        >
          Photo {i + 1}
        </button>
      ))}
    </span>
  );
}

function PhotoImage({ photo, alt, className }: { photo: NotePhoto; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === photo.url) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 p-6 text-center text-[12px] text-[#9496bf]", className)}>
        <ImageOff aria-hidden className="size-6" />
        This photo can’t be shown right now.
      </div>
    );
  }
  return (
    // Plain <img>: the route redirects to a short-lived private bucket URL (not a static asset).
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo.url} alt={alt} onError={() => setFailed(photo.url)} className={className} />
  );
}

function PhotoPanel({
  ref,
  photos,
  selected,
  onSelect,
  onExpand,
  flash,
}: {
  ref: React.Ref<HTMLElement>;
  photos: NotePhoto[];
  selected: number;
  onSelect: (i: number) => void;
  onExpand: () => void;
  flash: number;
}) {
  const photo = photos[selected];
  return (
    <aside
      ref={ref}
      aria-label="Your photos"
      className={cn(
        orbitCardClass,
        "relative order-1 gap-4 p-4 sm:p-5 lg:sticky lg:top-6 lg:order-2",
      )}
    >
      {flash ? (
        // Re-keyed on every "Photo N" click so the fade-out replays: a brief ring that says "here".
        <span
          key={flash}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-[#ff5e7a] animate-out fade-out duration-1000 fill-mode-forwards"
        />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className={orbitEyebrowClass}>YOUR PHOTOS</p>
        <p className="text-[11px] text-[#9496bf]">
          Photo {selected + 1} of {photos.length}
        </p>
      </div>
      <button
        type="button"
        onClick={onExpand}
        aria-label={`View photo ${selected + 1} full screen`}
        className="group relative block overflow-hidden rounded-[14px] bg-[#0b0c22]"
      >
        <PhotoImage
          photo={photo}
          alt={`Photo ${selected + 1} of your handwritten notes`}
          className="mx-auto max-h-[42vh] w-full object-contain lg:max-h-[calc(100dvh-14rem)]"
        />
        <span className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5 rounded-full bg-[#05061a]/80 px-2.5 py-1 text-[11px] text-white opacity-90 group-hover:opacity-100">
          <Maximize2 aria-hidden className="size-3.5" /> Full screen
        </span>
      </button>
      {photos.length > 1 ? (
        <div role="group" aria-label="Choose a photo" className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Photo ${i + 1}`}
              aria-pressed={i === selected}
              className={cn(
                "size-14 shrink-0 overflow-hidden rounded-[10px] border-2 bg-[#0b0c22] transition-colors",
                i === selected ? "border-[#ff5e7a]" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <PhotoImage photo={p} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

/** Full-screen photo with previous/next (buttons and ← → keys). */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: NotePhoto[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const count = photos.length;
  const go = (delta: number) => onIndexChange((index + delta + count) % count);
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });

  useEffect(() => {
    if (count < 2) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goRef.current(-1);
      if (e.key === "ArrowRight") goRef.current(1);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [count]);

  const navButton =
    "flex size-11 shrink-0 items-center justify-center rounded-full bg-[#1e1f45] text-white transition-colors hover:bg-[#2a2b5a] focus-visible:ring-2 focus-visible:ring-[#ff5e7a] focus-visible:outline-none";

  return (
    <Modal onClose={onClose} labelledBy={titleId} className="max-w-[min(1200px,100%)] gap-3 bg-[#0b0c22] p-3 sm:p-4">
      <p id={titleId} className="px-2 pt-1.5 pr-12 text-[13px] text-[#c1bedf]">
        Photo {index + 1} of {count}
      </p>
      <div className="flex min-h-0 items-center justify-center gap-2 sm:gap-3">
        {count > 1 ? (
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={navButton}>
            <ChevronLeft aria-hidden className="size-5" />
          </button>
        ) : null}
        <PhotoImage
          photo={photos[index]}
          alt={`Photo ${index + 1} of your handwritten notes`}
          className="max-h-[calc(100dvh-8rem)] min-w-0 flex-1 rounded-[12px] object-contain"
        />
        {count > 1 ? (
          <button type="button" onClick={() => go(1)} aria-label="Next photo" className={navButton}>
            <ChevronRight aria-hidden className="size-5" />
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
