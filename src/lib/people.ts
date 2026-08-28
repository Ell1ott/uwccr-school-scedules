import type { SelectedPerson, Student, Teacher } from "../types";

export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function matchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}

export function findById<T extends { id: string }>(
  items: T[],
  id: string | null | undefined,
): T | undefined {
  return id ? items.find((item) => item.id === id) : undefined;
}

export function selectedStudent(
  students: Student[],
  selected: SelectedPerson | null,
): Student | undefined {
  return selected?.kind === "student"
    ? findById(students, selected.id)
    : undefined;
}

export function selectedTeacher(
  teachers: Teacher[],
  selected: SelectedPerson | null,
): Teacher | undefined {
  return selected?.kind === "teacher"
    ? findById(teachers, selected.id)
    : undefined;
}
