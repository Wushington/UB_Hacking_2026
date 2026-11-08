"use client";

import { AudioLines, CloudUpload, ImageIcon, Lightbulb, Plus, ScanLine, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { NEW_SUBJECT, NO_SUBJECT, SubjectPicker, subjectChoice, type SubjectOption } from "@/components/subjects/subject-picker";
import { orbitCardClass, orbitEyebrowClass, OrbitPageHeading, Pill, type PillTone } from "@/components/orbit/shell";
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


const STATUS: Record<PhotoStatus, { label: string; tone: PillTone }> = {
  ready: { label: "Ready", tone: "success" },
  uploading: { label: "Uploading…", tone: "neutral" },
  uploaded: { label: "Uploaded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

const AI_STEPS = [
  { title: "Capture the important parts", body: "Read the board and pull out what matters." },
  { title: "Put ideas in order", body: "Group key concepts, definitions and examples." },
  { title: "Make it yours", body: "Review, edit and generate a quiz when ready." },
];

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
  const subjectName =
    subjectValue === NEW_SUBJECT ? newSubject.trim() : subjects.find((c) => c.id === subjectValue)?.name ?? "";

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
        eyebrow="01 / CAPTURE YOUR NOTES"
        title="Good notes start here."
        subtitle="Bring a whiteboard photo or lecture audio. We’ll help you connect the dots."
        aside={subjectName ? <Pill>{subjectName}</Pill> : null}
      />

      <div className="grid w-full grid-cols-1 items-start gap-[22px] lg:grid-cols-[minmax(0,857fr)_minmax(0,448fr)] lg:gap-6">
        <section aria-label="Add your class material" className={orbitCardClass}>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <h2 className="text-[19px] leading-[1.5] font-medium sm:text-[21px]">Add your class material</h2>
            {photos.length ? (
              <Pill tone="success">
                {photos.length} {photos.length === 1 ? "source" : "sources"} ready
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

          <div className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={locked || !signedIn}
              className="group flex flex-col items-start gap-3 rounded-[14px] border border-[#333564] bg-[#1e1f45] p-5 text-left transition-colors hover:border-[#ff5e7a]/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[#333564]"
            >
              <span className="flex w-full items-start justify-between">
                <ScanLine aria-hidden className="size-6 text-[#ff5e7a]" strokeWidth={1.75} />
                <Plus aria-hidden className="size-4 text-[#9496bf] group-hover:text-white" />
              </span>
              <span className="text-[15px] font-medium text-white">Whiteboard photo</span>
              <span className="text-[12px] text-[#9496bf]">JPG, PNG or HEIC · up to 20 MB</span>
            </button>
            <div
              aria-disabled
              className="flex flex-col items-start gap-3 rounded-[14px] border border-[#333564] bg-[#1e1f45] p-5 opacity-60"
            >
              <span className="flex w-full items-start justify-between">
                <AudioLines aria-hidden className="size-6 text-[#ff5e7a]" strokeWidth={1.75} />
                <Pill>Coming soon</Pill>
              </span>
              <span className="text-[15px] font-medium text-white">Lecture audio</span>
              <span className="text-[12px] text-[#9496bf]">MP3, M4A or WAV</span>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!locked && signedIn) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-[14px] border border-dashed px-5 py-7 text-center transition-colors",
              dragging ? "border-[#ff5e7a] bg-[#ff5e7a]/5" : "border-[#4a4c80]",
            )}
          >
            <CloudUpload aria-hidden className="size-6 text-[#ff5e7a]" strokeWidth={1.75} />
            <p className="text-[14px] text-white">
              Drop your files here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={locked || !signedIn}
                className="underline-offset-2 hover:underline disabled:no-underline"
              >
                browse files
              </button>
            </p>
            <p className="text-[12px] text-[#9496bf]">Add up to {MAX_PHOTOS} whiteboard photos, in the order you want them read.</p>
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
                        Whiteboard photo {photos.length > 1 ? `${i + 1} ` : ""}· {formatBytes(photo.file.size)}
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
            <div className="w-full sm:max-w-[310px]">
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
                className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] bg-[#ff5e7a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#ff7891] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#ff5e7a]"
              >
                <Sparkles aria-hidden className="size-[18px]" />
                {attempt ? "Try again" : "Organize notes"}
              </button>
            </div>
          </div>

          <div aria-live="polite" className="min-h-0">
            {loading ? null : !signedIn ? (
              <p className="text-[12px] text-[#9496bf]">Sign in (top right) to organize your notes.</p>
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

        <div className="flex w-full min-w-0 flex-col gap-[22px]">
          <section aria-label="How it works" className={orbitCardClass}>
            <p className={orbitEyebrowClass}>A LITTLE HELP FROM AI</p>
            <h2 className="text-[24px] leading-[1.3] font-medium tracking-[-0.5px] sm:text-[26px]">
              Less transcribing. More understanding.
            </h2>
            <p className="text-[14px] leading-[1.6] text-[#9496bf]">
              Your sources become one clear set of notes, saved right where they belong.
            </p>
            <ol className="flex flex-col gap-4">
              {AI_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3.5">
                  <span className="text-[12px] leading-[1.6] text-[#ff5e7a]">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex flex-col gap-1">
                    <p className="text-[14px] text-white">{step.title}</p>
                    <p className="text-[12px] text-[#9496bf]">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Tip" className="flex flex-col gap-3 rounded-[18px] bg-[#0b0c22] p-5 sm:rounded-[22px] sm:p-7">
            <div className="flex items-center gap-2.5">
              <Lightbulb aria-hidden className="size-[18px] text-[#ff5e7a]" strokeWidth={1.75} />
              <h2 className="text-[15px] font-medium">A clearer source, a better start</h2>
            </div>
            <p className="text-[13px] leading-[1.6] text-[#c1bedf]">
              Keep the whole board in frame, avoid glare, and add photos in the order the lecture went.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
