"use client";

import { AudioLines, CloudUpload, ImageIcon, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { NO_SUBJECT, SubjectPicker, subjectChoice, type SubjectOption } from "@/components/subjects/subject-picker";
import { HowItWorks } from "@/components/orbit/how-it-works";
import { orbitCardClass, OrbitPageHeading, Pill, type PillTone } from "@/components/orbit/shell";
import { cn } from "@/lib/utils";
import {
  CaptureError,
  discardLecture,
  formatBytes,
  MAX_PHOTOS,
  organizeNotes,
  photoMimeType,
  photoProblem,
  type OrganizeProgress,
  type PhotoStatus,
  type QueuedPhoto,
} from "./capture-api";


const HOW_IT_WORKS = {
  steps: ["Add photos of your notes, in reading order.", "Choose a subject.", "Generate your notes, then review them against your photos."],
  tip: {
    title: "Photo Tips",
    body: "Keep the whole board in frame and avoid glare. AI can make mistakes, so check your notes against your photos.",
  },
};

const STATUS: Record<PhotoStatus, { label: string; tone: PillTone }> = {
  ready: { label: "Ready", tone: "success" },
  uploading: { label: "Uploading…", tone: "neutral" },
  uploaded: { label: "Uploaded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

type Phase =
  | { kind: "idle" }
  | { kind: "working"; message: string }
  | { kind: "error"; message: string }
  | { kind: "done" };

/** The notes an earlier, unfinished attempt created, and the subject choice it was created with. */
type Attempt = { lectureId: string; categoryKey: string };

function progressMessage(p: OrganizeProgress): string | null {
  if (p.stage === "creating") return "Setting up your notes…";
  if (p.stage === "uploading") return p.total > 1 ? `Uploading photo ${p.index + 1} of ${p.total}…` : "Uploading your photo…";
  if (p.stage === "processing") return "Organizing your notes… this can take up to a minute.";
  return null;
}

export function CaptureWorkspace({
  subjects,
  signedIn,
  loading = false,
}: {
  subjects: SubjectOption[];
  signedIn: boolean;
  /** Placeholder while the session loads: everything disabled, no sign-in prompt. */
  loading?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [subjectValue, setSubjectValue] = useState<string>(subjects[0]?.id ?? NO_SUBJECT);
  const [newSubject, setNewSubject] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Set once the notes are created, so a retry with the same subject reuses them (and their uploaded photos).
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const succeeded = useRef(false);

  // Next keeps this page's state when you navigate away and back (React <Activity>). After a
  // successful upload, reset as the page is hidden so coming back shows a fresh form. Unfinished
  // work (photos added, a failed attempt) is kept. See node_modules/next/dist/docs: preserving-ui-state.
  useLayoutEffect(() => {
    return () => {
      if (!succeeded.current) return;
      succeeded.current = false;
      setPhotos([]);
      setAttempt(null);
      setNotice(null);
      setPhase({ kind: "idle" });
    };
  }, []);

  const working = phase.kind === "working" || phase.kind === "done";
  const locked = working; // editable again as soon as an attempt fails

  function addFiles(list: FileList | File[]) {
    const problems: string[] = [];
    const next = [...photos];
    for (const file of Array.from(list)) {
      const problem = photoProblem(file);
      if (problem) {
        problems.push(`${file.name}: ${problem}`);
        continue;
      }
      if (next.length >= MAX_PHOTOS) {
        problems.push(`You can add up to ${MAX_PHOTOS} photos at a time.`);
        break;
      }
      next.push({ key: crypto.randomUUID(), file, mimeType: photoMimeType(file)!, status: "ready" });
    }
    setPhotos(next);
    setNotice(problems.length ? [...new Set(problems)].join(" ") : null);
    if (phase.kind === "error") setPhase({ kind: "idle" });
  }

  function removePhoto(key: string) {
    setPhotos((all) => all.filter((p) => p.key !== key));
    if (phase.kind === "error") setPhase({ kind: "idle" });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!locked && signedIn) addFiles(e.dataTransfer.files);
  }

  function updatePhoto(key: string, patch: Partial<QueuedPhoto>) {
    setPhotos((all) => all.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  async function organize() {
    if (!photos.length) return;
    const picked = subjectChoice(subjectValue, newSubject);
    if ("error" in picked) {
      setPhase({ kind: "error", message: picked.error });
      return;
    }
    const category = picked.choice;
    const categoryKey = JSON.stringify(category);

    // A different subject than the failed attempt used: discard that attempt and start fresh,
    // re-uploading every photo.
    let lectureId = attempt?.lectureId ?? null;
    let queue = photos;
    if (attempt && attempt.categoryKey !== categoryKey) {
      void discardLecture(attempt.lectureId);
      setAttempt(null);
      lectureId = null;
      queue = photos.map((p) => ({ ...p, imageId: undefined, status: "ready" }));
      setPhotos(queue);
    }

    setPhase({ kind: "working", message: "Getting started…" });
    try {
      const id = await organizeNotes({ photos: queue, category, lectureId }, (p) => {
        if (p.lectureId) setAttempt({ lectureId: p.lectureId, categoryKey });
        if (p.stage === "uploading") updatePhoto(p.key, { status: "uploading" });
        if (p.stage === "uploaded") updatePhoto(p.key, { status: "uploaded", imageId: p.imageId });
        if (p.stage === "upload-failed") updatePhoto(p.key, { status: "failed" });
        const message = progressMessage(p);
        if (message) setPhase({ kind: "working", message });
      });
      succeeded.current = true;
      setPhase({ kind: "done" });
      router.push(`/lectures/${id}`);
    } catch (error) {
      setPhase({
        kind: "error",
        message: error instanceof CaptureError ? error.message : "Something went wrong. Please try again.",
      });
    }
  }

  function startOver() {
    if (attempt) void discardLecture(attempt.lectureId);
    setPhotos([]);
    setAttempt(null);
    setNotice(null);
    setPhase({ kind: "idle" });
  }

  return (
    <>
      <OrbitPageHeading
        title="Capture Notes"
        subtitle="Upload whiteboard photos to create organized notes."
        aside={<HowItWorks {...HOW_IT_WORKS} />}
      />

      <div className="w-full">
        <section aria-labelledby="add-photos-heading" className={orbitCardClass}>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <h2 id="add-photos-heading" className="text-[19px] leading-[1.5] font-medium sm:text-[21px]">Add Photos</h2>
            {photos.length ? (
              <Pill tone="success">
                {photos.length} {photos.length === 1 ? "photo" : "photos"} ready
              </Pill>
            ) : null}
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            className="hidden"
            data-testid="photo-input"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!locked && signedIn) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex w-full flex-col items-center gap-3 rounded-[14px] border border-dashed px-5 py-8 text-center transition-colors",
              dragging ? "border-[#ff5e7a] bg-[#ff5e7a]/5" : "border-[#4a4c80]",
            )}
          >
            <CloudUpload aria-hidden className="size-6 text-[#ff5e7a]" strokeWidth={1.75} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={locked || !signedIn}
              className={cn(
                "inline-flex h-[46px] items-center justify-center rounded-[10px] px-6 text-[14px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                photos.length ? "border border-[#333564] bg-[#1e1f45] hover:bg-[#2a2b5a]" : "bg-[#ff5e7a] hover:bg-[#ff7891]",
              )}
            >
              Upload Photos
            </button>
            <p className="text-[13px] text-white">or drop them here</p>
            <p className="text-[12px] leading-[1.5] text-[#9496bf]">JPG, PNG or HEIC · up to 20 MB each · up to {MAX_PHOTOS} photos, in reading order</p>
          </div>

          <div aria-disabled className="flex items-center gap-3 rounded-[12px] bg-[#1e1f45]/60 px-4 py-3 text-[13px] text-[#c1bedf]">
            <AudioLines aria-hidden className="size-[18px] shrink-0 text-[#9496bf]" strokeWidth={1.75} />
            <span>Lecture Audio</span>
            <span className="hidden text-[12px] text-[#9496bf] sm:inline">MP3, M4A or WAV</span>
            <span className="ml-auto">
              <Pill>Coming soon</Pill>
            </span>
          </div>

          {notice ? (
            <p role="status" className="text-[12px] leading-[1.5] text-[#ff5e7a]">
              {notice}
            </p>
          ) : null}

          {photos.length ? (
            <ul aria-label="Selected files" className="flex w-full flex-col gap-3">
              {photos.map((photo, i) => {
                const status = STATUS[photo.status];
                return (
                  <li key={photo.key} className="flex items-center gap-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#1e1f45]">
                      <ImageIcon aria-hidden className="size-[18px] text-[#ff5e7a]" strokeWidth={1.75} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate text-[14px] text-white">{photo.file.name}</p>
                      <p className="text-[11px] text-[#9496bf]">
                        Handwritten notes {photos.length > 1 ? `${i + 1} ` : ""}· {formatBytes(photo.file.size)}
                      </p>
                    </div>
                    <Pill tone={status.tone}>{status.label}</Pill>
                    <button
                      type="button"
                      aria-label={`Remove ${photo.file.name}`}
                      disabled={locked}
                      onClick={() => removePhoto(photo.key)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#c1bedf] transition-colors hover:bg-[#1e1f45] hover:text-white disabled:invisible"
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="h-px w-full bg-[#333564]" />

          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-[440px]">
              <SubjectPicker
                label="Assign to subject"
                subjects={subjects}
                value={subjectValue}
                onChange={setSubjectValue}
                newName={newSubject}
                onNewNameChange={setNewSubject}
                disabled={locked || !signedIn}
              />
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <button
                type="button"
                onClick={organize}
                disabled={!signedIn || !photos.length || working}
                className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] bg-[#ff5e7a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#ff7891] disabled:cursor-not-allowed disabled:bg-[#1e1f45] disabled:text-[#9496bf] disabled:hover:bg-[#1e1f45]"
              >
                <Sparkles aria-hidden className="size-[18px]" />
                {attempt ? "Try Again" : "Generate Notes"}
              </button>
            </div>
          </div>

          <div aria-live="polite" className="min-h-0">
            {loading ? null : !signedIn ? (
              <p className="text-[12px] text-[#9496bf]">Sign in (top right) to generate notes.</p>
            ) : phase.kind === "working" ? (
              <p className="text-[13px] text-[#c1bedf]">{phase.message}</p>
            ) : phase.kind === "done" ? (
              <p className="text-[13px] text-[#c1bedf]">Done! Opening your notes…</p>
            ) : phase.kind === "error" ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p role="alert" className="text-[13px] text-[#ff5e7a]">
                  {phase.message}
                </p>
                {attempt ? (
                  <button type="button" onClick={startOver} className="text-[12px] text-[#9496bf] underline-offset-2 hover:text-white hover:underline">
                    Start over with different photos
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
