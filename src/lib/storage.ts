import { DEFAULT_PALETTE, isPaletteId, type PaletteId } from "./tones";

const STORAGE_KEY = "uwccr-selected-student";
const PALETTE_KEY = "uwccr-color-palette";
const COMMUNITY_KEY = "uwccr-community-meeting";

export function readStoredStudentId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeStudentId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
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
