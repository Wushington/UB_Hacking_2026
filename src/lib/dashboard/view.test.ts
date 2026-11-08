import { describe, expect, it } from "vitest";
import { dayLabel, quizAccuracy, studyStreak } from "./view";

const NOW = new Date("2026-11-07T15:00:00Z");
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("studyStreak", () => {
  it("is 0 without study activity", () => {
    expect(studyStreak([], NOW)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(studyStreak([day("2026-11-07"), day("2026-11-06"), day("2026-11-06"), day("2026-11-05")], NOW)).toBe(3);
  });

  it("keeps a streak alive when the last session was yesterday", () => {
    expect(studyStreak([day("2026-11-06"), day("2026-11-05")], NOW)).toBe(2);
  });

  it("resets after a missed day", () => {
    expect(studyStreak([day("2026-11-05"), day("2026-11-04")], NOW)).toBe(0);
    expect(studyStreak([day("2026-11-07"), day("2026-11-05")], NOW)).toBe(1);
  });
});

describe("quizAccuracy", () => {
  it("is null when no cards were reviewed", () => {
    expect(quizAccuracy([])).toBeNull();
    expect(quizAccuracy([{ correctCount: 0, totalCount: 0 }])).toBeNull();
  });

  it("is the rounded share of correct cards across sessions", () => {
    expect(quizAccuracy([{ correctCount: 7, totalCount: 10 }, { correctCount: 2, totalCount: 2 }])).toBe(75);
  });
});

describe("dayLabel", () => {
  it("names today and yesterday, otherwise a short date", () => {
    expect(dayLabel(new Date("2026-11-07T01:00:00Z"), NOW)).toBe("Today");
    expect(dayLabel(new Date("2026-11-06T09:00:00Z"), NOW)).toBe("Yesterday");
    expect(dayLabel(new Date("2026-11-05T09:00:00Z"), NOW)).toBe("Nov 5");
  });
});
