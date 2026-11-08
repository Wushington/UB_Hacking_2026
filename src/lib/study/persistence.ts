import type { CompleteSession } from "@/contracts/study";

/** Saves a finished session. Implemented later by POST /api/study-sessions/[id]/complete. */
export type SaveStudyResults = (input: CompleteSession) => Promise<void>;
