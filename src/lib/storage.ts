import { DEFAULT_PALETTE, isPaletteId, type PaletteId } from "./tones";
import type { SelectedPerson } from "../types";

const STORAGE_KEY = "uwccr-selected-student";
const PERSON_KEY = "uwccr-selected-person";
const PALETTE_KEY = "uwccr-color-palette";
const COMMUNITY_KEY = "uwccr-community-meeting";

function parsePerson(value: string | null): SelectedPerson | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      "kind" in parsed &&
      "id" in parsed &&
      (parsed.kind === "student" || parsed.kind === "teacher") &&
      typeof parsed.id === "string" &&
      parsed.id
    ) {
      return { kind: parsed.kind, id: parsed.id };
    }
  } catch {
    /* ignore malformed */
  }
  return null;
}

export function readStoredPerson(): SelectedPerson | null {
  try {
    const person = parsePerson(localStorage.getItem(PERSON_KEY));
    if (person) return person;
    const studentId = localStorage.getItem(STORAGE_KEY);
    if (studentId) return { kind: "student", id: studentId };
  } catch {
    return null;
  }
  return null;
}

export function storePerson(person: SelectedPerson): void {
  try {
    localStorage.setItem(PERSON_KEY, JSON.stringify(person));
    if (person.kind === "student") {
      localStorage.setItem(STORAGE_KEY, person.id);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredStudentId(): string | null {
  const person = readStoredPerson();
  return person?.kind === "student" ? person.id : null;
}

export function storeStudentId(id: string): void {
  storePerson({ kind: "student", id });
}

export function readStoredPalette(): PaletteId {
  try {
    const value = localStorage.getItem(PALETTE_KEY);
    if (value && isPaletteId(value)) return value;
  } catch {
    /* ignore quota / private mode */
  }
  return DEFAULT_PALETTE;
}

export function storePalette(id: PaletteId): void {
  try {
    localStorage.setItem(PALETTE_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredCommunityMeeting(): boolean {
  try {
    return localStorage.getItem(COMMUNITY_KEY) === "1";
  } catch {
    return false;
  }
}

export function storeCommunityMeeting(on: boolean): void {
  try {
    localStorage.setItem(COMMUNITY_KEY, on ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}
