import type { CohortId } from "../types";
import { formatWeekRange, themeForWeek, weekHasCommunityMeeting } from "./calendar";

export function cohortCaption(cohort: CohortId, weekStart: string): string {
  return personCaption(`${cohort} 2026–2027`, weekStart);
}

export function teacherCaption(weekStart: string): string {
  return personCaption("Teacher · 2026–2027", weekStart);
}

function personCaption(base: string, weekStart: string): string {
  const parts = [base, formatWeekRange(weekStart)];
  if (weekHasCommunityMeeting(weekStart)) parts.push("Community");
  const theme = themeForWeek(weekStart);
  if (theme) parts.push(theme.replace(/^thematic week\s*#\s*\d+\s*-\s*/i, ""));
  return parts.join(" · ");
}
