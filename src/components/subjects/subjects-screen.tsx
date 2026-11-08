import { ChevronRight, ImageIcon, Plus } from "lucide-react";
import Link from "next/link";
import { orbitCardClass, OrbitPageHeading, Pill, type PillTone } from "@/components/orbit/shell";
import { groupBySubject, type SubjectLecture } from "./group-lectures";

const STATUS: Record<SubjectLecture["status"], { label: string; tone: PillTone }> = {
  ready: { label: "Notes ready", tone: "success" },
  processing: { label: "Organizing…", tone: "neutral" },
  draft: { label: "No notes yet", tone: "neutral" },
  failed: { label: "Needs another try", tone: "danger" },
};

const captureButton =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#ff5e7a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#ff7891]";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function SubjectsScreen({ lectures, signedIn }: { lectures: SubjectLecture[]; signedIn: boolean }) {
  const groups = groupBySubject(lectures);

  return (
    <>
      <OrbitPageHeading
        eyebrow="MY SUBJECTS"
        title="Everything you’ve captured."
        subtitle={signedIn ? "Open a set of notes to read it, change its subject, or turn it into flashcards." : "Sign in to see your subjects."}
        aside={
          signedIn ? (
            <Link href="/capture" className={captureButton}>
              <Plus aria-hidden className="size-[18px]" />
              Capture notes
            </Link>
          ) : null
        }
      />

      {signedIn && groups.length === 0 ? (
        <section className={orbitCardClass}>
          <p className="rounded-[12px] border border-dashed border-[#333564] px-5 py-8 text-center text-[14px] leading-[1.6] text-[#9496bf]">
            No subjects yet. Upload photos of your handwritten notes and they’ll show up here.
          </p>
        </section>
      ) : null}

      <div className="grid w-full grid-cols-1 items-start gap-[22px] lg:grid-cols-2 lg:gap-6">
        {groups.map((group) => (
          <section key={group.key} aria-label={group.name} className={orbitCardClass}>
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-[38px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#2a2b5a] text-[13px] font-semibold text-[#ff5e7a]"
                >
                  {group.key ? group.name.trim().charAt(0).toUpperCase() : "?"}
                </span>
                <h2 className="truncate text-[19px] font-medium">{group.name}</h2>
              </div>
              <Pill>{plural(group.lectures.length, "note set")}</Pill>
            </div>

            <ul className="flex w-full flex-col gap-1">
              {group.lectures.map((lecture) => {
                const status = STATUS[lecture.status];
                return (
                  <li key={lecture.id} className="flex items-center gap-2 rounded-[12px] odd:bg-[#1e1f45]/60">
                    <Link
                      href={`/lectures/${lecture.id}`}
                      className="group flex min-w-0 flex-1 items-center gap-3 rounded-[12px] p-3 transition-colors hover:bg-[#1e1f45]"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1e1f45]">
                        <ImageIcon aria-hidden className="size-4 text-[#ff5e7a]" strokeWidth={1.75} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[14px] text-white">{lecture.title}</span>
                        <span className="text-[11px] text-[#9496bf]">Updated {formatDate(lecture.updatedAt)}</span>
                      </span>
                      <Pill tone={status.tone}>{status.label}</Pill>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-[#9496bf] group-hover:text-white" />
                    </Link>
                    {lecture.status === "ready" ? (
                      <Link
                        href={`/lectures/${lecture.id}/study`}
                        className="mr-2 hidden shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#ff5e7a] transition-colors hover:bg-[#281d35] sm:inline-flex"
                      >
                        Flashcards
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
