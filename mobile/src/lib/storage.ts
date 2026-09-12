import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_PALETTE, isPaletteId, type PaletteId } from "@shared/lib/tones";
import type { SelectedPerson } from "@shared/types";

const PERSON_KEY = "uwccr-selected-person";
const PALETTE_KEY = "uwccr-color-palette";
const LESSON_ICONS_KEY = "uwccr-lesson-icons";

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
    /* ignore */
  }
  return null;
}

export async function readStoredPerson(): Promise<SelectedPerson | null> {
  try {
    return parsePerson(await AsyncStorage.getItem(PERSON_KEY));
  } catch {
    return null;
  }
}

export async function storePerson(person: SelectedPerson): Promise<void> {
  try {
    await AsyncStorage.setItem(PERSON_KEY, JSON.stringify(person));
  } catch {
    /* ignore */
  }
}

export async function readStoredPalette(): Promise<PaletteId> {
  try {
    const value = await AsyncStorage.getItem(PALETTE_KEY);
    if (value && isPaletteId(value)) return value;
  } catch {
    /* ignore */
  }
  return DEFAULT_PALETTE;
}

export async function storePalette(id: PaletteId): Promise<void> {
  try {
    await AsyncStorage.setItem(PALETTE_KEY, id);
  } catch {
    /* ignore */
  }
}

export async function readStoredLessonIcons(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(LESSON_ICONS_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function storeLessonIcons(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(LESSON_ICONS_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
