"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, RotateCcw, Sparkles, X } from "lucide-react";
import type { ReviewResult } from "@/contracts/study";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SaveStudyResults } from "@/lib/study/persistence";
import { currentCard, gradeCard, isComplete, revealAnswer, scoreSession, startSession, type StudyCard, type StudySession } from "@/lib/study/session";
import { cn } from "@/lib/utils";

type Props = {
  deckTitle: string;
  subtitle: string;
  cards: StudyCard[];
  onComplete?: SaveStudyResults;
  random?: () => number;
  isSample?: boolean;
};

const panel = "flex flex-col rounded-[22px] bg-[#161730] shadow-[0_6px_24px_rgba(0,0,0,0.13)]";
const eyebrow = "text-[10px] font-semibold tracking-[1.5px] uppercase text-[#9496bf]";
const primary = "h-[46px] rounded-[12px] px-[18px] bg-[#ff5e7a] text-white text-[13px] font-semibold hover:bg-[#ff5e7a]/90 disabled:opacity-45";
const secondary = "h-[46px] rounded-[12px] px-[18px] bg-[#1e1f45] border border-[#333564] text-white text-[13px] font-semibold hover:bg-[#333564] disabled:opacity-45";

export function StudySessionView({ deckTitle, subtitle, cards, onComplete, random, isSample = false }: Props) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const activeCards = useRef<StudyCard[] | null>(null);
  const savedSession = useRef<StudyCard[] | null>(null);

  useEffect(() => {
    const initial = startSession(cards, random);
    activeCards.current = initial.cards;
    savedSession.current = null;
    // Randomize only after hydration so the server and initial client HTML agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(initial);
    setSaveStatus("idle");
    return () => { activeCards.current = null; };
  }, [cards, random]);

  async function save(completed: StudySession) {
    if (!onComplete || activeCards.current !== completed.cards || savedSession.current === completed.cards) return;
    savedSession.current = completed.cards;
    setSaveStatus("saving");
    try {
      await onComplete({ results: completed.results });
      if (activeCards.current === completed.cards) setSaveStatus("saved");
    } catch {
      if (activeCards.current === completed.cards) setSaveStatus("error");
    }
  }

  function grade(result: ReviewResult) {
    if (!session) return;
    const next = gradeCard(session, result);
    if (next === session) return;
    // A queued event for an old card must never grade the next card.
    setSession((previous) => previous === session ? next : previous);
    if (isComplete(next)) void save(next);
  }

  function restart() {
    const next = startSession(cards, random);
    activeCards.current = next.cards;
    savedSession.current = null;
    setSaveStatus("idle");
    setSession(next);
  }

  const complete = session !== null && session.cards.length > 0 && isComplete(session);
  const card = session ? currentCard(session) : undefined;
  const graded = session?.results.length ?? 0;
  const total = session?.cards.length ?? cards.length;
  const score = scoreSession(session?.results ?? []);

  return (
    <div className="min-h-full flex-1 bg-[#0d0e2a] text-[#e8e6ff]">
      <div className="mx-auto flex max-w-[1328px] flex-col gap-7 px-4 pt-9 pb-8 sm:px-14">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className={eyebrow}>{complete ? "Your study results" : "Study your flashcards"}</p>
            <h1 className="text-3xl font-medium tracking-[-1.3px] text-white sm:text-[36px]">
              {complete ? "A little clearer. A little closer." : "Let’s see what’s sticking."}
            </h1>
            <p className="text-sm text-[#9496bf]">
              {complete ? `${deckTitle} · Completed just now` : "A little challenge from your notes. No timer, no pressure."}
            </p>
          </div>
          {isSample && <Badge className="h-auto rounded-full bg-[#1e1f45] px-2.5 py-1 text-[11px] text-[#c1bedf]">Sample deck</Badge>}
        </header>

        {!session ? (
          <div className={cn(panel, "p-8")} role="status">Preparing your deck…</div>
        ) : total === 0 ? (
          <section className={cn(panel, "gap-2 p-8")}>
            <h2 className="text-xl text-white">No flashcards in this deck yet.</h2>
            <p className="text-sm text-[#9496bf]">Generate flashcards from your notes to start studying.</p>
          </section>
        ) : complete ? (
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex flex-col gap-5 lg:w-[322px] lg:shrink-0">
              <section className={cn(panel, "gap-[19px] p-[26px]")}>
                <h2 className={eyebrow}>Your understanding</h2>
                <p className="text-[76px] leading-[1.1] tracking-[-5px] text-white">{score.percent}%</p>
                <p className="text-sm">{score.correct} correct out of {score.total} cards</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[#163d38] px-3 py-1 text-[#4ecba0]">{score.correct} got it</span>
                  <span className="rounded-full bg-[#3c2338] px-3 py-1 text-[#ff5e7a]">{score.missed} missed</span>
                </div>
              </section>
              <section className={cn(panel, "gap-4 bg-[#0a0b1e] p-[26px]")} aria-label="Session saving">
                <p aria-live="polite" className="text-[13px] text-[#c1bedf]">
                  {!onComplete ? "This session wasn't saved. Saving study results isn't connected yet."
                    : saveStatus === "saving" ? "Saving…"
                    : saveStatus === "saved" ? "Saved"
                    : saveStatus === "error" ? "Couldn't save this session. Please try again."
                    : "Ready to save."}
                </p>
                {onComplete && saveStatus === "error" && (
                  <Button className={secondary} onClick={() => { savedSession.current = null; void save(session); }}>Try again</Button>
                )}
                <Button className={cn(primary, "w-full")} onClick={restart}><RotateCcw aria-hidden="true" />Study again</Button>
              </section>
            </div>
            <section className={cn(panel, "min-w-0 gap-3 p-6 lg:flex-1")}>
              <h2 className="text-[21px] font-medium text-white">A closer look at your answers</h2>
              <ol>
                {session.cards.map((reviewCard, index) => {
                  const correct = session.results[index].result === "got_it";
                  return (
                    <li key={reviewCard.id} className={cn("flex gap-3 border-b border-[#333564] px-2.5 py-[9px]", !correct && "bg-[#231b35] py-3")}>
                      <span className={cn("mt-0.5 flex size-[27px] shrink-0 items-center justify-center rounded-full", correct ? "bg-[#163d38] text-[#4ecba0]" : "bg-[#3c2338] text-[#ff5e7a]")}>
                        {correct ? <Check aria-hidden="true" className="size-3.5" /> : <X aria-hidden="true" className="size-3.5" />}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-[13px] font-medium break-words">{String(index + 1).padStart(2, "0")} &nbsp; {reviewCard.question}</p>
                          <span className={cn("text-[10px] whitespace-nowrap", correct ? "text-[#4ecba0]" : "text-[#ff5e7a]")}>{correct ? "Got it" : "Missed"}</span>
                        </div>
                        <p className="text-[11px] break-words text-[#9496bf]">{reviewCard.answer}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        ) : card ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <section className={cn(panel, "min-w-0 gap-6 p-8 lg:flex-1")}>
              <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium">Card {session.index + 1} of {total}</span>
                <span className="text-xs text-[#9496bf]">{graded} graded</span>
              </div>
              <div className="flex gap-1.5" aria-hidden="true">
                {session.cards.map((item, index) => <span key={item.id} className={cn("h-1 flex-1 rounded", index < session.index ? "bg-[#ff5e7a]" : index === session.index ? "bg-[#c1bedf]" : "bg-[#333564]")} />)}
              </div>
              <div className="flex flex-col gap-3">
                <p className={eyebrow}>{card.conceptLabel}</p>
                <h2 className="text-[28px] leading-[1.35] font-medium tracking-[-0.5px] break-words text-white">{card.question}</h2>
                <p className="text-[13px] text-[#9496bf]">{session.revealed ? "Be honest — did you get it?" : "Think of your answer, then reveal it."}</p>
              </div>
              {session.revealed && (
                <div className="flex min-h-[66px] flex-col gap-2 rounded-[12px] border-[1.5px] border-[#ff5e7a] bg-[#2d244b] p-4">
                  <p className={eyebrow}>Answer</p>
                  <p className="text-sm break-words text-white">{card.answer}</p>
                </div>
              )}
              <div className="h-px bg-[#333564]" />
              <div className="flex flex-wrap justify-between gap-3">
                <Button className={secondary} disabled={session.revealed} onClick={() => setSession(revealAnswer(session))}><Eye aria-hidden="true" />Reveal answer</Button>
                <div className="flex flex-wrap gap-2">
                  <Button className={secondary} disabled={!session.revealed} onClick={() => grade("missed")}><X aria-hidden="true" />Missed</Button>
                  <Button className={primary} disabled={!session.revealed} onClick={() => grade("got_it")}><Check aria-hidden="true" />Got it</Button>
                </div>
              </div>
            </section>
            <aside className="flex flex-col gap-[22px] lg:w-[400px] lg:shrink-0">
              <section className={cn(panel, "gap-5 p-7")}>
                <p className={eyebrow}>From your notes</p>
                <div className="flex flex-col gap-2">
                  <h2 className="text-[23px] text-white">{deckTitle}</h2>
                  <p className="text-xs text-[#9496bf]">{subtitle}</p>
                </div>
                <div className="h-px bg-[#333564]" />
                <div><p className="text-[26px] text-white">{total}</p><p className="text-[11px] text-[#9496bf]">Cards</p></div>
              </section>
              <section className={cn(panel, "gap-5 p-6")}>
                <div className="flex items-center justify-between gap-2"><h2 className={eyebrow}>Your progress</h2><p className="text-xs text-[#9496bf]">{graded} / {total} done</p></div>
                <div className="flex flex-wrap gap-2">
                  {session.cards.map((item, index) => {
                    const result = session.results[index]?.result;
                    return <span key={item.id} className={cn("flex h-9 w-14 items-center justify-center rounded-[9px] text-xs", result === "got_it" ? "bg-[#163d38] text-[#4ecba0]" : result === "missed" ? "bg-[#3c2338] text-[#ff5e7a]" : index === session.index ? "border border-[#ff5e7a] bg-[#3c2338] text-[#ff5e7a]" : "bg-[#1e1f45] text-[#9496bf]")}>{index + 1}</span>;
                  })}
                </div>
                <p className="text-[11px] text-[#9496bf]">Got it · Missed · Current · Up next</p>
              </section>
              <div className="flex gap-2.5 p-4 text-xs text-[#9496bf]">
                <Sparkles aria-hidden="true" className="size-[18px] shrink-0 text-[#ff5e7a]" />
                <p>A missed card is useful. It shows you exactly what to revisit next.</p>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
