import { compare } from "typo-safe-search";
import type { SelectedPerson, Student, Teacher } from "../types";

const RELATED = 0.7;

export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function personScore<T extends { name: string }>(
  item: T,
  query: string,
  extraKeys: ReadonlyArray<(item: T) => string>,
): number {
  const needle = fold(query);
  const fields = [item.name, ...item.name.split(/\s+/), ...extraKeys.map((getKey) => getKey(item))];
  return Math.max(0, ...fields.map((field) => compare(fold(field), needle)));
}

export function searchPeople<T extends { name: string }>(
  items: readonly T[],
  query: string,
  extraKeys: ReadonlyArray<(item: T) => string> = [],
): T[] {
  const q = query.trim();
  if (!q) return [...items];
  return items
    .map((item) => ({ item, score: personScore(item, q, extraKeys) }))
    .filter(({ score }) => score > RELATED)
    .sort(
      (a, b) => b.score - a.score || compareNames(a.item.name, b.item.name),
    )
    .map(({ item }) => item);
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
