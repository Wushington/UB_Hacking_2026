"use client";

import { useMemo } from "react";
import { saveStudyResultsFor } from "@/lib/study/persistence";
import type { StudyCard } from "@/lib/study/session";
import { StudySessionView } from "./study-session";

type Props = { deckId: string; deckTitle: string; subtitle: string; cards: StudyCard[] };

/** A real deck's study session: finished runs are saved to the user's history and weak concepts. */
export function DeckStudy({ deckId, ...view }: Props) {
  const save = useMemo(() => saveStudyResultsFor(deckId), [deckId]);
  return <StudySessionView {...view} onComplete={save} />;
}
