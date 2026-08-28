import type { EventKind, ScheduleEvent } from "../types";

export type Tone = {
  bg: string;
  bgColor?: string;
  text: string;
  bar: string;
  chip: string;
};

export type PaletteId =
  | "classic"
  | "vivid"
  | "pastel"
  | "grove"
  | "dusk"
  | "clay"
  | "tide"
  | "noir"
  | "system";

export const PALETTE_OPTIONS: {
  id: PaletteId;
  label: string;
  hint: string;
  swatches: string[];
}[] = [
  {
    id: "system",
    label: "System",
    hint: "iOS blue, red, pink, green",
    swatches: [
      "oklch(0.900 0.062 257.4)",
      "oklch(0.900 0.067 28.7)",
      "oklch(0.900 0.068 17.9)",
      "oklch(0.900 0.072 147.4)",
      "oklch(0.900 0.062 278.3)",
    ],
  },
  {
    id: "classic",
    label: "Classic",
    hint: "Original navy and cream",
    swatches: [
      "bg-secondary-container",
      "bg-primary-container",
      "bg-primary-fixed",
      "bg-tertiary-fixed",
      "bg-tertiary-container",
    ],
  },
  {
    id: "vivid",
    label: "Vivid",
    hint: "Bright and distinct",
    swatches: [
      "bg-rose-400",
      "bg-amber-400",
      "bg-emerald-400",
      "bg-sky-400",
      "bg-violet-400",
    ],
  },
  {
    id: "pastel",
    label: "Pastel",
    hint: "Cool, quiet mist",
    swatches: [
      "bg-sky-200",
      "bg-teal-200",
      "bg-indigo-200",
      "bg-violet-200",
      "bg-slate-300",
    ],
  },
  {
    id: "grove",
    label: "Grove",
    hint: "Sage, moss, and fern",
    swatches: [
      "oklch(0.925 0.048 155)",
      "oklch(0.925 0.048 102)",
      "oklch(0.925 0.048 142)",
      "oklch(0.925 0.048 185)",
      "oklch(0.925 0.048 88)",
    ],
  },
  {
    id: "dusk",
    label: "Dusk",
    hint: "Twilight blues and violets",
    swatches: [
      "oklch(0.915 0.042 250)",
      "oklch(0.915 0.042 270)",
      "oklch(0.915 0.042 300)",
      "oklch(0.915 0.042 325)",
      "oklch(0.915 0.042 240)",
    ],
  },
  {
    id: "clay",
    label: "Clay",
    hint: "Adobe, sand, and terracotta",
    swatches: [
      "oklch(0.93 0.055 45)",
      "oklch(0.93 0.055 22)",
      "oklch(0.93 0.055 68)",
      "oklch(0.93 0.055 38)",
      "oklch(0.93 0.055 12)",
    ],
  },
  {
    id: "tide",
    label: "Tide",
    hint: "Sea glass and lake water",
    swatches: [
      "oklch(0.935 0.04 175)",
      "oklch(0.935 0.04 205)",
      "oklch(0.935 0.04 230)",
      "oklch(0.935 0.04 190)",
      "oklch(0.935 0.04 218)",
    ],
  },
  {
    id: "noir",
    label: "Noir",
    hint: "Graphite with a hint of hue",
    swatches: [
      "oklch(0.88 0.03 40)",
      "oklch(0.88 0.03 150)",
      "oklch(0.88 0.03 230)",
      "oklch(0.88 0.03 290)",
      "oklch(0.88 0.03 350)",
    ],
  },
];

export const DEFAULT_PALETTE: PaletteId = "system";

export type SubjectKey =
  | "biology"
  | "chemistry"
  | "physics"
  | "ess"
  | "psychology"
  | "math-aa"
  | "math-ai"
  | "english-lit"
  | "english-ll"
  | "english-b"
  | "spanish-b"
  | "spanish-ll"
  | "spanish-ab"
  | "french-b"
  | "ssst"
  | "history"
  | "economics"
  | "global-politics"
  | "anthropology"
  | "visual-arts"
  | "theatre"
  | "tok"
  | "fallback";

/** Pale wash + black ink. Color lives in the background, not the type. */
function wash(bg: string, bar: string): Tone {
  return {
    bg,
    text: "text-black",
    bar,
    chip: "bg-black/10",
  };
}

function oklchWash(l: number, c: number, h: number): Tone {
  return {
    bg: "",
    bgColor: `oklch(${l} ${c} ${h})`,
    text: "text-black",
    bar: "bg-black/20",
    chip: "bg-black/10",
  };
}

function byHue(
  l: number,
  c: number,
  hues: Record<SubjectKey, number>,
): Record<SubjectKey, Tone> {
  const next = {} as Record<SubjectKey, Tone>;
  for (const key of Object.keys(hues) as SubjectKey[]) {
    next[key] = oklchWash(l, c, hues[key]);
  }
  return next;
}

const vivid: Record<SubjectKey, Tone> = {
  biology: wash("bg-emerald-100", "bg-emerald-900"),
  chemistry: wash("bg-orange-100", "bg-orange-900"),
  physics: wash("bg-indigo-100", "bg-indigo-900"),
  ess: wash("bg-lime-100", "bg-lime-900"),
  psychology: wash("bg-pink-100", "bg-pink-900"),
  "math-aa": wash("bg-blue-100", "bg-blue-900"),
  "math-ai": wash("bg-sky-100", "bg-sky-900"),
  "english-lit": wash("bg-rose-100", "bg-rose-900"),
  "english-ll": wash("bg-red-100", "bg-red-900"),
  "english-b": wash("bg-fuchsia-100", "bg-fuchsia-900"),
  "spanish-b": wash("bg-amber-100", "bg-amber-900"),
  "spanish-ll": wash("bg-yellow-100", "bg-yellow-900"),
  "spanish-ab": wash("bg-green-100", "bg-green-900"),
  "french-b": wash("bg-violet-100", "bg-violet-900"),
  ssst: wash("bg-cyan-100", "bg-cyan-900"),
  history: wash("bg-stone-200", "bg-stone-800"),
  economics: wash("bg-yellow-50", "bg-yellow-900"),
  "global-politics": wash("bg-red-50", "bg-red-900"),
  anthropology: wash("bg-zinc-200", "bg-zinc-800"),
  "visual-arts": wash("bg-purple-100", "bg-purple-900"),
  theatre: wash("bg-fuchsia-50", "bg-fuchsia-900"),
  tok: wash("bg-teal-100", "bg-teal-900"),
  fallback: wash("bg-slate-100", "bg-slate-800"),
};

const pastel: Record<SubjectKey, Tone> = {
  biology: wash("bg-teal-100", "bg-primary"),
  chemistry: wash("bg-sky-100", "bg-primary"),
  physics: wash("bg-indigo-100", "bg-primary"),
  ess: wash("bg-emerald-100", "bg-primary"),
  psychology: wash("bg-violet-100", "bg-primary"),
  "math-aa": wash("bg-blue-100", "bg-primary"),
  "math-ai": wash("bg-slate-100", "bg-primary"),
  "english-lit": wash("bg-rose-100", "bg-primary"),
  "english-ll": wash("bg-pink-100", "bg-primary"),
  "english-b": wash("bg-fuchsia-100", "bg-primary"),
  "spanish-b": wash("bg-amber-100", "bg-primary"),
  "spanish-ll": wash("bg-orange-100", "bg-primary"),
  "spanish-ab": wash("bg-yellow-100", "bg-primary"),
  "french-b": wash("bg-purple-100", "bg-primary"),
  ssst: wash("bg-cyan-100", "bg-primary"),
  history: wash("bg-stone-100", "bg-primary"),
  economics: wash("bg-stone-50", "bg-primary"),
  "global-politics": wash("bg-slate-100", "bg-primary"),
  anthropology: wash("bg-zinc-100", "bg-primary"),
  "visual-arts": wash("bg-violet-50", "bg-primary"),
  theatre: wash("bg-fuchsia-50", "bg-primary"),
  tok: wash("bg-cyan-50", "bg-primary"),
  fallback: wash("bg-slate-50", "bg-primary"),
};

const grove = byHue(0.925, 0.048, {
  biology: 155,
  chemistry: 95,
  physics: 190,
  ess: 142,
  psychology: 128,
  "math-aa": 172,
  "math-ai": 185,
  "english-lit": 102,
  "english-ll": 110,
  "english-b": 118,
  "spanish-b": 88,
  "spanish-ll": 108,
  "spanish-ab": 135,
  "french-b": 162,
  ssst: 178,
  history: 98,
  economics: 90,
  "global-politics": 168,
  anthropology: 115,
  "visual-arts": 148,
  theatre: 138,
  tok: 180,
  fallback: 150,
});

const dusk = byHue(0.915, 0.042, {
  biology: 265,
  chemistry: 310,
  physics: 250,
  ess: 275,
  psychology: 300,
  "math-aa": 245,
  "math-ai": 255,
  "english-lit": 325,
  "english-ll": 335,
  "english-b": 318,
  "spanish-b": 290,
  "spanish-ll": 305,
  "spanish-ab": 280,
  "french-b": 270,
  ssst: 258,
  history: 240,
  economics: 295,
  "global-politics": 330,
  anthropology: 248,
  "visual-arts": 285,
  theatre: 315,
  tok: 262,
  fallback: 260,
});

const clay = byHue(0.93, 0.055, {
  biology: 72,
  chemistry: 45,
  physics: 28,
  ess: 78,
  psychology: 18,
  "math-aa": 55,
  "math-ai": 62,
  "english-lit": 22,
  "english-ll": 32,
  "english-b": 12,
  "spanish-b": 50,
  "spanish-ll": 42,
  "spanish-ab": 68,
  "french-b": 8,
  ssst: 58,
  history: 38,
  economics: 75,
  "global-politics": 15,
  anthropology: 35,
  "visual-arts": 5,
  theatre: 25,
  tok: 65,
  fallback: 40,
});

const tide = byHue(0.935, 0.04, {
  biology: 175,
  chemistry: 205,
  physics: 230,
  ess: 168,
  psychology: 220,
  "math-aa": 235,
  "math-ai": 215,
  "english-lit": 195,
  "english-ll": 200,
  "english-b": 190,
  "spanish-b": 185,
  "spanish-ll": 180,
  "spanish-ab": 170,
  "french-b": 225,
  ssst: 210,
  history: 198,
  economics: 188,
  "global-politics": 228,
  anthropology: 192,
  "visual-arts": 218,
  theatre: 208,
  tok: 200,
  fallback: 202,
});

const noir = byHue(0.88, 0.03, {
  biology: 150,
  chemistry: 40,
  physics: 265,
  ess: 140,
  psychology: 320,
  "math-aa": 250,
  "math-ai": 220,
  "english-lit": 15,
  "english-ll": 350,
  "english-b": 330,
  "spanish-b": 55,
  "spanish-ll": 70,
  "spanish-ab": 85,
  "french-b": 280,
  ssst: 200,
  history: 45,
  economics: 90,
  "global-politics": 25,
  anthropology: 60,
  "visual-arts": 300,
  theatre: 340,
  tok: 230,
  fallback: 240,
});

/** iOS system hues, tinted toward white in OKLab to L=0.90 so text stays black. */
const system: Record<SubjectKey, Tone> = {
  biology: oklchWash(0.9, 0.072, 147.4),
  chemistry: oklchWash(0.9, 0.068, 45.6),
  physics: oklchWash(0.9, 0.062, 278.3),
  ess: oklchWash(0.9, 0.07, 164.1),
  psychology: oklchWash(0.9, 0.062, 344.7),
  "math-aa": oklchWash(0.9, 0.062, 257.4),
  "math-ai": oklchWash(0.9, 0.062, 244.1),
  "english-lit": oklchWash(0.9, 0.067, 28.7),
  "english-ll": oklchWash(0.9, 0.062, 1.3),
  "english-b": oklchWash(0.9, 0.068, 17.9),
  "spanish-b": oklchWash(0.9, 0.068, 62.6),
  "spanish-ll": oklchWash(0.9, 0.069, 79.6),
  "spanish-ab": oklchWash(0.9, 0.07, 96.5),
  "french-b": oklchWash(0.9, 0.062, 267.9),
  ssst: oklchWash(0.9, 0.062, 214.2),
  history: oklchWash(0.9, 0.07, 113.5),
  economics: oklchWash(0.9, 0.071, 130.5),
  "global-politics": oklchWash(0.9, 0.062, 328.1),
  anthropology: oklchWash(0.9, 0.067, 180.8),
  "visual-arts": oklchWash(0.9, 0.062, 294.9),
  theatre: oklchWash(0.9, 0.062, 311.5),
  tok: oklchWash(0.9, 0.062, 230.8),
  fallback: oklchWash(0.9, 0.064, 197.5),
};

const classicFamilies = {
  language: {
    bg: "bg-secondary-container",
    text: "text-black",
    bar: "bg-secondary",
    chip: "bg-secondary/20",
  },
  humanities: {
    bg: "bg-tertiary-container",
    text: "text-white",
    bar: "bg-tertiary-fixed-dim",
    chip: "bg-white/15",
  },
  science: {
    bg: "bg-primary-container",
    text: "text-white",
    bar: "bg-primary-fixed-dim",
    chip: "bg-white/15",
  },
  maths: {
    bg: "bg-primary-fixed",
    text: "text-black",
    bar: "bg-primary",
    chip: "bg-primary/15",
  },
  arts: {
    bg: "bg-tertiary-fixed",
    text: "text-black",
    bar: "bg-tertiary",
    chip: "bg-tertiary/15",
  },
  tok: {
    bg: "bg-secondary-fixed",
    text: "text-black",
    bar: "bg-secondary",
    chip: "bg-secondary/15",
  },
} as const satisfies Record<string, Tone>;

const classic: Record<SubjectKey, Tone> = {
  biology: classicFamilies.science,
  chemistry: classicFamilies.science,
  physics: classicFamilies.science,
  ess: classicFamilies.humanities,
  psychology: classicFamilies.humanities,
  "math-aa": classicFamilies.maths,
  "math-ai": classicFamilies.maths,
  "english-lit": classicFamilies.language,
  "english-ll": classicFamilies.language,
  "english-b": classicFamilies.language,
  "spanish-b": classicFamilies.language,
  "spanish-ll": classicFamilies.language,
  "spanish-ab": classicFamilies.language,
  "french-b": classicFamilies.language,
  ssst: classicFamilies.language,
  history: classicFamilies.humanities,
  economics: classicFamilies.humanities,
  "global-politics": classicFamilies.humanities,
  anthropology: classicFamilies.humanities,
  "visual-arts": classicFamilies.arts,
  theatre: classicFamilies.arts,
  tok: classicFamilies.tok,
  fallback: classicFamilies.humanities,
};

const KIND_TONES_CHROME: Record<string, Tone> = {
  study: {
    bg: "bg-surface-container-lowest",
    text: "text-black",
    bar: "bg-outline-variant",
    chip: "bg-surface-container",
  },
  meal: {
    bg: "bg-surface-container",
    text: "text-black",
    bar: "bg-outline-variant",
    chip: "bg-surface-container-high",
  },
  office: {
    bg: "bg-slate-100",
    text: "text-black",
    bar: "bg-primary",
    chip: "bg-black/10",
  },
  residential: {
    bg: "bg-residential-container",
    text: "text-black",
    bar: "bg-residential",
    chip: "bg-black/10",
  },
  activity: {
    bg: "bg-stone-100",
    text: "text-black",
    bar: "bg-primary",
    chip: "bg-black/10",
  },
  community: {
    bg: "bg-emerald-100",
    text: "text-black",
    bar: "bg-emerald-800",
    chip: "bg-black/10",
  },
  school_event: {
    bg: "bg-amber-100",
    text: "text-black",
    bar: "bg-amber-900",
    chip: "bg-black/10",
  },
  holiday: {
    bg: "bg-zinc-200",
    text: "text-black",
    bar: "bg-zinc-500",
    chip: "bg-black/10",
  },
};

const KIND_TONES: Record<PaletteId, Record<string, Tone>> = {
  vivid: KIND_TONES_CHROME,
  pastel: KIND_TONES_CHROME,
  grove: KIND_TONES_CHROME,
  dusk: KIND_TONES_CHROME,
  clay: KIND_TONES_CHROME,
  tide: KIND_TONES_CHROME,
  noir: KIND_TONES_CHROME,
  system: KIND_TONES_CHROME,
  classic: {
    study: {
      bg: "bg-surface-container-lowest",
      text: "text-black",
      bar: "bg-outline-variant",
      chip: "bg-surface-container",
    },
    meal: {
      bg: "bg-surface-container",
      text: "text-black",
      bar: "bg-outline-variant",
      chip: "bg-surface-container-high",
    },
    office: {
      bg: "bg-primary-fixed",
      text: "text-black",
      bar: "bg-primary",
      chip: "bg-primary/15",
    },
    residential: {
      bg: "bg-residential-container",
      text: "text-black",
      bar: "bg-residential",
      chip: "bg-residential/15",
    },
    activity: {
      bg: "bg-tertiary-fixed",
      text: "text-black",
      bar: "bg-tertiary",
      chip: "bg-tertiary/15",
    },
    community: {
      bg: "bg-emerald-100",
      text: "text-black",
      bar: "bg-emerald-800",
      chip: "bg-black/10",
    },
    school_event: {
      bg: "bg-tertiary-fixed",
      text: "text-black",
      bar: "bg-tertiary",
      chip: "bg-tertiary/15",
    },
    holiday: {
      bg: "bg-surface-container-high",
      text: "text-black",
      bar: "bg-outline",
      chip: "bg-black/10",
    },
  },
};

const SUBJECT_PALETTES: Record<PaletteId, Record<SubjectKey, Tone>> = {
  classic,
  vivid,
  pastel,
  grove,
  dusk,
  clay,
  tide,
  noir,
  system,
};

export function subjectKey(subject: string): SubjectKey {
  const n = subject.toLowerCase();
  if (n.includes("tok") || n.includes("tdc")) return "tok";
  if (n.includes("biology")) return "biology";
  if (n.includes("chemistry")) return "chemistry";
  if (n.includes("physics")) return "physics";
  if (n === "ess" || n.startsWith("ess ") || n.includes("environmental")) {
    return "ess";
  }
  if (n.includes("psychology")) return "psychology";
  if (n.includes("analysis")) return "math-aa";
  if (n.includes("application")) return "math-ai";
  if (n.includes("math") || n.includes("mate")) return "math-aa";
  if (n.includes("english") && n.includes("lang")) return "english-ll";
  if (n.includes("english") && n.includes("lit")) return "english-lit";
  if (n.includes("english")) return "english-b";
  if (n.includes("spanish") && n.includes("lang")) return "spanish-ll";
  if (n.includes("spanish") && n.includes("ab")) return "spanish-ab";
  if (n.includes("spanish")) return "spanish-b";
  if (n.includes("french")) return "french-b";
  if (n.includes("ssst")) return "ssst";
  if (n.includes("history")) return "history";
  if (n.includes("economic")) return "economics";
  if (n.includes("politic") || n.includes("global")) return "global-politics";
  if (n.includes("anthropolog")) return "anthropology";
  if (n.includes("theatre") || n.includes("theater")) return "theatre";
  if (n.includes("art")) return "visual-arts";
  return "fallback";
}

export function isPaletteId(value: string): value is PaletteId {
  return PALETTE_OPTIONS.some((option) => option.id === value);
}

export function toneForEvent(
  event: ScheduleEvent,
  palette: PaletteId = DEFAULT_PALETTE,
): Tone {
  if (event.kind === "class") {
    return SUBJECT_PALETTES[palette][subjectKey(event.title)];
  }
  if (event.kind === "study") return KIND_TONES[palette].study;
  if (event.kind === "break" || event.kind === "meal") {
    return KIND_TONES[palette].meal;
  }
  if (event.kind === "office") return KIND_TONES[palette].office;
  if (event.kind === "residential") return KIND_TONES[palette].residential;
  if (event.kind === "community") return KIND_TONES[palette].community;
  if (event.kind === "school_event") return KIND_TONES[palette].school_event;
  if (event.kind === "holiday") return KIND_TONES[palette].holiday;
  return KIND_TONES[palette].activity;
}

export function isBandKind(kind: EventKind): boolean {
  return kind === "break" || kind === "meal";
}
