import { Check, Search, User } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useDismissible } from "../hooks/useDismissible";
import {
  compareNames,
  matchesQuery,
  selectedStudent,
  selectedTeacher,
} from "../lib/people";
import type { SelectedPerson, Student, Teacher } from "../types";

type Hit = {
  kind: SelectedPerson["kind"];
  id: string;
  name: string;
  badge: string;
};

function isSelected(hit: Hit, selected: SelectedPerson | null): boolean {
  return selected?.kind === hit.kind && selected.id === hit.id;
}

export function StudentPicker({
  students,
  teachers,
  selected,
  onSelect,
  inlineList,
  fieldClassName,
}: {
  students: Student[];
  teachers: Teacher[];
  selected: SelectedPerson | null;
  onSelect: (person: SelectedPerson) => void;
  inlineList?: boolean;
  fieldClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedName =
    selectedTeacher(teachers, selected)?.name ??
    selectedStudent(students, selected)?.name;

  const results = useMemo(() => {
    const hits: Hit[] = [
      ...students
        .filter((student) => matchesQuery(student.name, query))
        .map((student) => ({
          kind: "student" as const,
          id: student.id,
          name: student.name,
          badge: student.cohort,
        })),
      ...teachers
        .filter((teacher) => matchesQuery(teacher.name, query))
        .map((teacher) => ({
          kind: "teacher" as const,
          id: teacher.id,
          name: teacher.name,
          badge: "Teacher",
        })),
    ];
    hits.sort((a, b) => compareNames(a.name, b.name));
    return hits;
  }, [students, teachers, query]);

  useDismissible(wrapRef, () => setOpen(false));

  function choose(hit: Hit) {
    onSelect({ kind: hit.kind, id: hit.id });
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`relative w-full min-w-0 ${inlineList ? "" : "max-w-md md:max-w-xs"}`}>
      <div
        className={`flex items-center gap-1.5 rounded-full focus-within:ring-2 focus-within:ring-primary/20 ${fieldClassName ?? "h-8.5 bg-surface-container-lowest px-2.5"}`}
      >
        <Search
          size={14}
          strokeWidth={1.75}
          className="shrink-0 text-on-surface-variant"
          aria-hidden
        />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full bg-transparent text-[13px] leading-5 text-on-surface outline-none placeholder:text-on-surface-variant/70"
          placeholder={selectedName ? selectedName : "Search students & teachers"}
          value={open ? query : selectedName && !open ? "" : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && results[activeIndex]) {
              e.preventDefault();
              choose(results[activeIndex]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {selectedName ? (
          <button
            type="button"
            className="shrink-0 text-primary"
            aria-label="Selected person"
            onClick={() => setOpen(true)}
          >
            <User
              size={15}
              strokeWidth={1.75}
              className="opacity-50"
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className={`${inlineList ? "relative" : "absolute z-50"} menu-panel mt-2 max-h-72 w-full overflow-auto py-2`}
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-body-md text-on-surface-variant">
              No one matches that name
            </li>
          ) : (
            results.map((hit, index) => (
              <li
                key={`${hit.kind}:${hit.id}`}
                role="option"
                aria-selected={isSelected(hit, selected)}
              >
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-body-md ${
                    index === activeIndex
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface hover:bg-surface-container"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(hit)}
                >
                  <span className="min-w-0 flex-1 truncate">{hit.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-medium tracking-wide text-on-surface-variant">
                      {hit.badge}
                    </span>
                    {isSelected(hit, selected) ? (
                      <Check size={14} strokeWidth={1.75} aria-hidden />
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
