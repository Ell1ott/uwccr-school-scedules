import { useMemo, useRef } from "react";
import { initials } from "../lib/classDetail";
import type { Student } from "../types";

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function letterFor(name: string): string {
  const char = name.trim().charAt(0).toLocaleUpperCase();
  return /[A-Z]/.test(char) ? char : "#";
}

function groupedStudents(students: Student[]): [string, Student[]][] {
  const sorted = [...students].sort((a, b) => compareNames(a.name, b.name));
  const groups = new Map<string, Student[]>();
  for (const student of sorted) {
    const letter = letterFor(student.name);
    const list = groups.get(letter);
    if (list) list.push(student);
    else groups.set(letter, [student]);
  }
  return [...groups.entries()];
}

export function StudentRoster({
  students,
  onSelect,
}: {
  students: Student[];
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => groupedStudents(students), [students]);
  const letters = groups.map(([letter]) => letter);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function jumpTo(letter: string) {
    sectionRefs.current[letter]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-container-padding-mobile pb-16 md:px-container-padding-desktop">
      <div className="pt-8 pb-6 md:pt-10">
        <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
          IB1 · {students.length} students
        </p>
        <h2 className="mt-1 text-headline-lg-mobile tracking-tight md:text-headline-lg">
          Find yourself
        </h2>
        <p className="mt-2 max-w-lg text-body-md text-on-surface-variant">
          Names are A–Z. Tap a card, or search up top if you already know yours.
        </p>
      </div>

      <nav
        aria-label="Jump to letter"
        className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-20 -mx-container-padding-mobile border-b border-outline-variant/60 bg-surface/90 px-container-padding-mobile py-2 backdrop-blur-xl md:-mx-container-padding-desktop md:px-container-padding-desktop"
      >
        <ul className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {letters.map((letter) => (
            <li key={letter}>
              <button
                type="button"
                className="flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                onClick={() => jumpTo(letter)}
              >
                {letter}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 flex flex-col gap-8">
        {groups.map(([letter, group]) => (
          <section
            key={letter}
            ref={(node) => {
              sectionRefs.current[letter] = node;
            }}
            aria-labelledby={`roster-letter-${letter}`}
            className="scroll-mt-[calc(8.75rem+env(safe-area-inset-top,0px))]"
          >
            <h3
              id={`roster-letter-${letter}`}
              className="mb-3 flex items-baseline gap-2 text-label-sm tracking-[0.16em] text-on-surface-variant uppercase"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[12px] font-semibold tracking-normal text-on-primary">
                {letter}
              </span>
              <span className="font-medium tracking-normal text-on-surface-variant/80 normal-case">
                {group.length}
              </span>
            </h3>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-[14px] bg-surface-container-lowest px-3 py-2.5 text-left shadow-[0_4px_12px_rgba(4,22,39,0.05)] transition-[filter,box-shadow,transform] duration-200 hover:shadow-[0_6px_16px_rgba(4,22,39,0.1)] hover:brightness-[0.99] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    onClick={() => onSelect(student.id)}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-container text-[12px] font-semibold tracking-wide text-on-secondary-container">
                      {initials(student.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body-md font-medium text-on-surface">
                      {student.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
