import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { track } from "../lib/analytics";
import { initials } from "../lib/classDetail";
import { compareNames, matchesQuery } from "../lib/people";
import { subjectSummary } from "../lib/teachers";
import type { PersonKind, SelectedPerson, Student, Teacher } from "../types";
import { FloatingTabs } from "./FloatingTabs";
import { MobileHubButton } from "./MobileHub";

const ROSTER_TABS = [
  { id: "student", label: "Students" },
  { id: "teacher", label: "Teachers" },
] as const;

function letterFor(name: string): string {
  const char = name.trim().charAt(0).toLocaleUpperCase();
  return /[A-Z]/.test(char) ? char : "#";
}

type RosterCard = {
  id: string;
  name: string;
  subtitle: string;
};

function groupedPeople(people: RosterCard[]): [string, RosterCard[]][] {
  const sorted = [...people].sort((a, b) => compareNames(a.name, b.name));
  const groups = new Map<string, RosterCard[]>();
  for (const person of sorted) {
    const letter = letterFor(person.name);
    const list = groups.get(letter);
    if (list) list.push(person);
    else groups.set(letter, [person]);
  }
  return [...groups.entries()];
}

export function StudentRoster({
  students,
  teachers,
  onSelect,
  onOpenLogin,
  onOpenFeedback,
  hubOpen,
  onOpenHub,
}: {
  students: Student[];
  teachers: Teacher[];
  onSelect: (person: SelectedPerson) => void;
  onOpenLogin?: () => void;
  onOpenFeedback?: () => void;
  hubOpen?: boolean;
  onOpenHub?: () => void;
}) {
  const [tab, setTab] = useState<PersonKind>("student");
  const [query, setQuery] = useState("");
  const people = useMemo((): RosterCard[] => {
    if (tab === "teacher") {
      return teachers.map((teacher) => ({
        id: teacher.id,
        name: teacher.name,
        subtitle: subjectSummary(teacher),
      }));
    }
    return students.map((student) => ({
      id: student.id,
      name: student.name,
      subtitle: student.cohort,
    }));
  }, [tab, students, teachers]);
  const filtered = useMemo(
    () => people.filter((person) => matchesQuery(person.name, query)),
    [people, query],
  );
  const groups = useMemo(() => groupedPeople(filtered), [filtered]);
  const letters = groups.map(([letter]) => letter);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function jumpTo(letter: string) {
    sectionRefs.current[letter]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const countLabel =
    tab === "teacher"
      ? `${teachers.length} teachers`
      : `${students.length} students`;

  return (
    <div className="mx-auto max-w-6xl px-container-padding-mobile pt-safe pb-16 md:px-container-padding-desktop md:pt-0">
      <div className="flex items-start justify-between gap-3 pt-8 pb-6 md:pt-10">
        <div className="min-w-0">
          <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            IB1 & IB2 · {countLabel}
          </p>
          <h2 className="mt-1 text-headline-lg-mobile tracking-tight md:text-headline-lg">
            Find yourself
          </h2>
        </div>
        {onOpenHub ? (
          <MobileHubButton
            className="md:hidden"
            expanded={hubOpen}
            onClick={onOpenHub}
          />
        ) : null}
      </div>
      <div className="pb-6">
        <p className="mt-0 max-w-lg text-body-md text-on-surface-variant">
          Names are A–Z. Tap a card
          <span className="md:hidden">, or search if you already know yours</span>
          <span className="hidden md:inline">
            , or search up top if you already know yours
          </span>
          .{" "}
          {onOpenLogin ? (
            <button
              type="button"
              className="font-medium text-on-surface underline-offset-2 hover:underline"
              onClick={onOpenLogin}
            >
              Log in for events, or to cancel a class if you teach.
            </button>
          ) : null}
          {onOpenFeedback ? (
            <>
              {onOpenLogin ? " " : null}
              <button
                type="button"
                className="font-medium text-on-surface underline-offset-2 hover:underline"
                onClick={onOpenFeedback}
              >
                Send feedback
              </button>
              {" anytime."}
            </>
          ) : null}
        </p>
        <div className="mt-4 w-fit rounded-2xl bg-surface-container p-1.5">
          <FloatingTabs
            ariaLabel="Roster"
            value={tab}
            options={ROSTER_TABS}
            onChange={(kind) => {
              if (kind !== tab) track("roster_tab_changed", { tab: kind });
              setTab(kind);
            }}
          />
        </div>
        <label className="mt-4 flex items-center gap-2 rounded-full bg-surface-container px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/20 md:hidden">
          <span className="sr-only">Search names</span>
          <Search
            size={16}
            strokeWidth={1.75}
            className="shrink-0 text-on-surface-variant"
            aria-hidden
          />
          <input
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent text-body-md text-on-surface outline-none placeholder:text-on-surface-variant/70"
            placeholder="Search names"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {groups.length > 0 ? (
        <>
          <nav
            aria-label="Jump to letter"
            className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-container-padding-mobile border-b border-outline-variant/60 bg-surface-container-lowest/90 px-container-padding-mobile py-2 backdrop-blur-xl md:top-[calc(3rem+env(safe-area-inset-top,0px))] md:-mx-container-padding-desktop md:px-container-padding-desktop"
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
                className="scroll-mt-[calc(5.5rem+env(safe-area-inset-top,0px))] md:scroll-mt-[calc(7.75rem+env(safe-area-inset-top,0px))]"
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
                  {group.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-[14px] bg-surface-container-low px-3 py-2.5 text-left shadow-[0_4px_12px_rgba(4,22,39,0.05)] transition-[filter,box-shadow,transform] duration-200 hover:shadow-[0_6px_16px_rgba(4,22,39,0.1)] hover:brightness-[0.99] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        onClick={() => onSelect({ kind: tab, id: person.id })}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-container text-[12px] font-semibold tracking-wide text-on-secondary-container">
                          {initials(person.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-md font-medium text-on-surface">
                            {person.name}
                          </span>
                          <span className="block truncate text-[11px] font-medium tracking-wide text-on-surface-variant">
                            {person.subtitle}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-body-md text-on-surface-variant">
          {tab === "teacher"
            ? "No teachers match that name"
            : "No students match that name"}
        </p>
      )}
    </div>
  );
}
