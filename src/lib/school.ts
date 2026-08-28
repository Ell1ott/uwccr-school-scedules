import type { BlockLetter, CohortId } from "../types";

export const BLOCK_LETTERS: BlockLetter[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
];

export const LEVEL_ORDER = ["HL", "SL", "TOK"] as const;

export const COHORTS: CohortId[] = ["IB1", "IB2"];

export const COHORT_TABS = COHORTS.map((id) => ({ id, label: id }));

export function isBlockLetter(value: string): value is BlockLetter {
  return (BLOCK_LETTERS as string[]).includes(value);
}
