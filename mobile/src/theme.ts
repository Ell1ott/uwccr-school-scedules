import type { Tone } from "@shared/lib/tones";

export const colors = {
  primary: "#041627",
  onPrimary: "#ffffff",
  surface: "#fbf9fa",
  surfaceDim: "#f5f5f5",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f5f3f4",
  surfaceContainer: "#efedef",
  surfaceContainerHigh: "#e9e7e9",
  onSurface: "#1b1c1d",
  onSurfaceVariant: "#44474c",
  outline: "#74777d",
  outlineVariant: "#c4c6cd",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  inverseSurface: "#303032",
  inverseOnSurface: "#f2f0f2",
  secondaryContainer: "#d0e1fb",
  primaryContainer: "#1a2b3c",
  primaryFixed: "#d2e4fb",
  tertiaryFixed: "#feddb5",
  tertiaryContainer: "#38260b",
  secondaryFixed: "#d3e4fe",
  residential: "#8d4a2b",
  residentialContainer: "#f3e0d2",
  onResidentialContainer: "#4a2614",
};

export const reach = {
  bg: "#f2f2f7",
  card: "#ffffff",
  ink: "#1c1c1e",
  muted: "#8e8e93",
  line: "rgba(60, 60, 67, 0.12)",
  blue: "#007aff",
  fill: "#e5e5ea",
  green: "#34c759",
  red: "#ff3b30",
  orange: "#ff9500",
  purple: "#3634a3",
  purpleFill: "#eef0ff",
  okFill: "#e8f8ed",
  okInk: "#1f8a3b",
  waitFill: "#eef0ff",
  waitInk: "#3634a3",
  badFill: "#fff1e6",
  badInk: "#c93400",
  docsFill: "#fff1e6",
  docsInk: "#c93400",
  autoFill: "#e8f8ed",
  autoInk: "#1f8a3b",
  rcFill: "#eef0ff",
  rcInk: "#3634a3",
  inactive: "#c7c7cc",
};

const CLASS_HEX: Record<string, string> = {
  "bg-emerald-50": "#ecfdf5",
  "bg-emerald-100": "#d1fae5",
  "bg-emerald-200": "#a7f3d0",
  "bg-emerald-300": "#6ee7b7",
  "bg-emerald-800": "#065f46",
  "bg-emerald-900": "#064e3b",
  "bg-orange-100": "#ffedd5",
  "bg-orange-900": "#7c2d12",
  "bg-indigo-100": "#e0e7ff",
  "bg-indigo-900": "#312e81",
  "bg-lime-100": "#ecfccb",
  "bg-lime-900": "#365314",
  "bg-pink-100": "#fce7f3",
  "bg-pink-900": "#831843",
  "bg-blue-100": "#dbeafe",
  "bg-blue-900": "#1e3a8a",
  "bg-sky-100": "#e0f2fe",
  "bg-sky-200": "#bae6fd",
  "bg-sky-900": "#0c4a6e",
  "bg-rose-100": "#ffe4e6",
  "bg-rose-900": "#881337",
  "bg-red-50": "#fef2f2",
  "bg-red-100": "#fee2e2",
  "bg-red-900": "#7f1d1d",
  "bg-fuchsia-50": "#fdf4ff",
  "bg-fuchsia-100": "#fae8ff",
  "bg-fuchsia-900": "#701a75",
  "bg-amber-100": "#fef3c7",
  "bg-amber-900": "#78350f",
  "bg-yellow-50": "#fefce8",
  "bg-yellow-100": "#fef9c3",
  "bg-yellow-900": "#713f12",
  "bg-green-100": "#dcfce7",
  "bg-green-900": "#14532d",
  "bg-violet-50": "#f5f3ff",
  "bg-violet-100": "#ede9fe",
  "bg-violet-200": "#ddd6fe",
  "bg-violet-900": "#4c1d95",
  "bg-cyan-50": "#ecfeff",
  "bg-cyan-100": "#cffafe",
  "bg-cyan-900": "#164e63",
  "bg-stone-50": "#fafaf9",
  "bg-stone-100": "#f5f5f4",
  "bg-stone-200": "#e7e5e4",
  "bg-stone-400": "#a8a29e",
  "bg-stone-800": "#292524",
  "bg-zinc-100": "#f4f4f5",
  "bg-zinc-200": "#e4e4e7",
  "bg-zinc-500": "#71717a",
  "bg-zinc-800": "#27272a",
  "bg-purple-100": "#f3e8ff",
  "bg-purple-900": "#581c87",
  "bg-teal-100": "#ccfbf1",
  "bg-slate-50": "#f8fafc",
  "bg-slate-100": "#f1f5f9",
  "bg-slate-300": "#cbd5e1",
  "bg-slate-800": "#1e293b",
  "bg-black/10": "rgba(0,0,0,0.08)",
  "bg-black/20": "rgba(0,0,0,0.16)",
  "bg-surface-container-lowest": "#ffffff",
  "bg-surface-container": "#efedef",
  "bg-surface-container-high": "#e9e7e9",
  "bg-outline-variant": "#c4c6cd",
  "bg-outline": "#74777d",
  "bg-secondary-container": "#d0e1fb",
  "bg-primary-container": "#1a2b3c",
  "bg-primary-fixed": "#d2e4fb",
  "bg-tertiary-fixed": "#feddb5",
  "bg-tertiary-container": "#38260b",
  "bg-secondary-fixed": "#d3e4fe",
  "bg-residential-container": "#f3e0d2",
};

function oklchToHex(l: number, c: number, h: number): string {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;
  const rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  const toSrgb = (x: number) => {
    const clamped = Math.min(1, Math.max(0, x));
    const encoded =
      clamped <= 0.0031308
        ? 12.92 * clamped
        : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(255 * encoded);
  };
  return `#${[toSrgb(rLin), toSrgb(gLin), toSrgb(bLin)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseOklch(value: string): string | null {
  const match = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!match) return null;
  return oklchToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function toneColors(tone: Tone): { bg: string; text: string; bar: string } {
  const fromOklch = tone.bgColor ? parseOklch(tone.bgColor) : null;
  const bg =
    fromOklch ??
    CLASS_HEX[tone.bg] ??
    (tone.bgColor && tone.bgColor.startsWith("#") ? tone.bgColor : colors.surfaceContainer);
  const text = tone.text.includes("white") ? "#ffffff" : "#000000";
  const bar = CLASS_HEX[tone.bar] ?? colors.primary;
  return { bg, text, bar };
}
