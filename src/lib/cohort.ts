import type { CohortId } from "../types";

export function cohortCaption(
  cohort: CohortId,
  communityMeeting = false,
): string {
  const base = `${cohort} 2026–2027`;
  return communityMeeting ? `${base} · Community meeting` : base;
}

export function teacherCaption(communityMeeting = false): string {
  const base = "Teacher · 2026–2027";
  return communityMeeting ? `${base} · Community meeting` : base;
}

