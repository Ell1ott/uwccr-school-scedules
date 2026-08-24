/** Spreadsheet spellings that are the same person. Keys and values are display names. */
export const TEACHER_ALIASES: Record<string, string> = {
  Jeff: "Jeff N.",
  "Jeff N.": "Jeff N.",
  "Jeff L": "Jeff Lile",
  "Jeff Lile": "Jeff Lile",
};

export function canonicalTeacherName(name: string): string {
  const trimmed = name.trim();
  return TEACHER_ALIASES[trimmed] ?? trimmed;
}
