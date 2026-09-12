import { Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { initials } from "../lib/classDetail";
import { compareNames, matchesQuery } from "../lib/people";
import type { Student } from "../types";

export function CompanionPicker({
  students,
  selectedIds,
  excludeId,
  onChange,
}: {
  students: Student[];
  selectedIds: string[];
  excludeId: string | null;
  onChange: (ids: string[]) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => students.find((student) => student.id === id))
        .filter((student): student is Student => Boolean(student)),
    [selectedIds, students],
  );
  const results = useMemo(() => {
    const picked = new Set(selectedIds);
    const pool = students.filter(
      (student) => student.id !== excludeId && !picked.has(student.id),
    );
    const me = excludeId
      ? students.find((student) => student.id === excludeId)
      : undefined;
    const filtered = query.trim()
      ? pool.filter((student) => matchesQuery(student.name, query))
      : pool;
    const cohort = me
      ? filtered.filter((student) => student.cohort === me.cohort)
      : [];
    const rest = me
      ? filtered.filter((student) => student.cohort !== me.cohort)
      : filtered;
    cohort.sort((a, b) => compareNames(a.name, b.name));
    rest.sort((a, b) => compareNames(a.name, b.name));
    return query.trim()
      ? [...cohort, ...rest].slice(0, 12)
      : [...cohort, ...rest].slice(0, 16);
  }, [students, excludeId, selectedIds, query]);

  const myCohort = excludeId
    ? students.find((student) => student.id === excludeId)?.cohort
    : null;

  function add(id: string) {
    if (selectedIds.includes(id) || id === excludeId) return;
    onChange([...selectedIds, id]);
    setQuery("");
    setActiveIndex(0);
  }

  function remove(id: string) {
    onChange(selectedIds.filter((item) => item !== id));
  }

  return (
    <div>
      {selected.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {selected.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-residential-container py-1 pr-2 pl-1 text-label-sm tracking-wide text-on-residential-container"
                onClick={() => remove(student.id)}
              >
                <span
                  className="flex size-6 items-center justify-center rounded-full bg-residential text-[10px] font-semibold text-on-residential"
                  aria-hidden
                >
                  {initials(student.name)}
                </span>
                {student.name.split(" ")[0]}
                <X size={12} strokeWidth={2} aria-hidden />
                <span className="sr-only">Remove {student.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-2 rounded-2xl bg-surface-container px-3 focus-within:ring-2 focus-within:ring-primary/20">
        <Search
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-on-surface-variant"
          aria-hidden
        />
        <input
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          className="h-12 w-full bg-transparent text-body-md outline-none placeholder:text-on-surface-variant/70"
          placeholder={
            selected.length ? "Add another person" : "Type a name — enter adds"
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) =>
                Math.min(index + 1, Math.max(results.length - 1, 0)),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              add(results[activeIndex].id);
            } else if (
              event.key === "Backspace" &&
              !query &&
              selectedIds.length
            ) {
              remove(selectedIds[selectedIds.length - 1]);
            }
          }}
        />
      </div>

      <ul
        id={listId}
        role="listbox"
        className="mt-2 max-h-64 overflow-auto rounded-2xl bg-surface-container-low py-1"
      >
        {results.length === 0 ? (
          <li className="px-4 py-3 text-body-md text-on-surface-variant">
            {query.trim()
              ? "No one matches that name"
              : "Everyone you can invite is already on this leave"}
          </li>
        ) : (
          results.map((student, index) => {
            const showCohortLabel =
              !query.trim() &&
              myCohort &&
              student.cohort === myCohort &&
              (index === 0 || results[index - 1]?.cohort !== myCohort);
            const showRestLabel =
              !query.trim() &&
              myCohort &&
              student.cohort !== myCohort &&
              (index === 0 || results[index - 1]?.cohort === myCohort);
            return (
              <li key={student.id}>
                {showCohortLabel ? (
                  <p className="px-4 pt-2 pb-1 text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                    Your year
                  </p>
                ) : null}
                {showRestLabel ? (
                  <p className="px-4 pt-2 pb-1 text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                    Everyone else
                  </p>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    index === activeIndex
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface hover:bg-surface-container"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => add(student.id)}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-label-sm font-semibold"
                    aria-hidden
                  >
                    {initials(student.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-md">
                    {student.name}
                  </span>
                  <span className="text-[11px] font-medium tracking-wide text-on-surface-variant">
                    {student.cohort}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
