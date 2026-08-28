import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Shuffle } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import type { SelectedPerson, Student, Teacher } from "../types";
import { PalettePicker } from "./PalettePicker";
import { StudentPicker } from "./StudentPicker";
import { WeekNav } from "./WeekNav";

export type AppTabId = "week" | "classes";

const APP_TABS = [
  { id: "week", label: "Week" },
  { id: "classes", label: "Try classes" },
] as const;

const TAB_RADIUS = 12;
const TAB_SLANT = 10;
const TAB_FILLET = 10;
const TAB_JOIN = 3;

function folderTabPath(width: number, height: number): string {
  const s = Math.min(TAB_SLANT, width / 4);
  const length = Math.hypot(s, height);
  const r = Math.min(TAB_RADIUS, height / 3, (width - s * 2) / 5);
  const f = Math.min(TAB_FILLET, height / 3);
  const nx = height / length;
  const ny = s / length;

  const topCx = s + (r * length - r * s) / height;
  const topLeftX = topCx - r * nx;
  const topLeftY = r - r * ny;

  const filletX = (-f * (length - s)) / height;
  const filletY = height - f;
  const bottomLeftX = filletX + f * nx;
  const bottomLeftY = filletY + f * ny;

  return [
    `M ${filletX} ${height}`,
    `A ${f} ${f} 0 0 0 ${bottomLeftX} ${bottomLeftY}`,
    `L ${topLeftX} ${topLeftY}`,
    `A ${r} ${r} 0 0 1 ${topCx} 0`,
    `L ${width - topCx} 0`,
    `A ${r} ${r} 0 0 1 ${width - topLeftX} ${topLeftY}`,
    `L ${width - bottomLeftX} ${bottomLeftY}`,
    `A ${f} ${f} 0 0 0 ${width - filletX} ${height}`,
    "Z",
  ].join(" ");
}

function FolderTabFace({ selected }: { selected: boolean }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const face = wrapRef.current;
    const tab = face?.parentElement;
    if (!tab || !selected) return;

    function draw() {
      if (!tab) return;
      const w = tab.offsetWidth;
      const h = tab.offsetHeight;
      if (w < 1 || h < 1) return;
      setSize({ w, h });
    }

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(tab);
    return () => observer.disconnect();
  }, [selected]);

  const path =
    selected && size.w > 0 ? folderTabPath(size.w, size.h) : "";
  const svgW = size.w + TAB_FILLET * 2;
  const svgH = size.h + TAB_JOIN;

  return (
    <span className="folder-tab-face" ref={wrapRef} aria-hidden>
      {path ? (
        <svg
          width={svgW}
          height={svgH}
          viewBox={`${-TAB_FILLET} 0 ${svgW} ${svgH}`}
        >
          <path d={path} />
          <rect x={0} y={size.h - 1} width={size.w} height={TAB_JOIN + 1} />
        </svg>
      ) : null}
    </span>
  );
}

function TabIcon({ id }: { id: AppTabId }) {
  if (id === "classes") {
    return (
      <Shuffle size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
    );
  }

  return (
    <HugeiconsIcon
      icon={Calendar03Icon}
      size={16}
      color="currentColor"
      strokeWidth={1.75}
      className="shrink-0"
      aria-hidden
    />
  );
}

function AppTabs({
  tab,
  onTabChange,
}: {
  tab: AppTabId;
  onTabChange: (tab: AppTabId) => void;
}) {
  return (
    <div role="tablist" aria-label="Views" className="folder-tabs">
      {APP_TABS.map((item) => {
        const selected = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-label={item.label}
            aria-selected={selected}
            aria-controls={`${item.id}-panel`}
            className="folder-tab text-label-sm tracking-wide"
            onClick={() => onTabChange(item.id)}
          >
            <FolderTabFace selected={selected} />
            <TabIcon id={item.id} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AppHeader({
  tab,
  onTabChange,
  weekStart,
  onWeekChange,
  students,
  teachers,
  selected,
  onSelect,
  onOpenLogin,
}: {
  tab: AppTabId;
  onTabChange: (tab: AppTabId) => void;
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
  students: Student[];
  teachers: Teacher[];
  selected: SelectedPerson | null;
  onSelect: (person: SelectedPerson) => void;
  onOpenLogin?: () => void;
}) {
  const auth = useAuth();

  return (
    <header className="sticky top-0 z-50 hidden w-full bg-surface-dim pt-safe md:block">
      <div className="flex h-12 items-stretch gap-2 px-container-padding-desktop">
        <div className="flex min-w-0 self-stretch gap-1">
          <div className="flex min-w-0 items-center pt-2">
            <WeekNav
              variant="float"
              weekStart={weekStart}
              onChange={onWeekChange}
            />
          </div>
          <AppTabs tab={tab} onTabChange={onTabChange} />
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {auth.teacherName ? (
            <button
              type="button"
              className="flex h-8.5 shrink-0 items-center rounded-full bg-surface-container-lowest px-2.5 text-label-sm tracking-wide text-on-surface-variant"
              onClick={() => void auth.signOut()}
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              className="flex h-8.5 shrink-0 items-center rounded-full bg-surface-container-lowest px-2.5 text-label-sm tracking-wide text-on-surface-variant"
              onClick={() => onOpenLogin?.()}
            >
              Staff
            </button>
          )}
          <PalettePicker />
          <div className="w-36 min-w-0 lg:w-64">
            <StudentPicker
              students={students}
              teachers={teachers}
              selected={selected}
              onSelect={onSelect}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
