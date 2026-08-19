import { Check, Search, User } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { storeStudentId } from "../lib/storage";
import type { Student } from "../types";

function matches(student: Student, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return student.name.toLowerCase().includes(q);
}

export function StudentPicker({
  students,
  selectedId,
  onSelect,
}: {
  students: Student[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = students.find((s) => s.id === selectedId) ?? null;

  const results = useMemo(
    () =>
      students
        .filter((s) => matches(s, query))
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
            numeric: true,
          }),
        ),
    [students, query],
  );

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function choose(id: string) {
    onSelect(id);
    storeStudentId(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative w-full min-w-0 max-w-md md:max-w-xs">
      <div className="flex items-center gap-2 rounded-full bg-surface-container px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20">
        <Search
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-on-surface-variant"
          aria-hidden
        />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full bg-transparent text-body-md text-on-surface outline-none placeholder:text-on-surface-variant/70"
          placeholder={selected ? selected.name : "Search students"}
          value={open ? query : selected && !open ? "" : query}
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
              choose(results[activeIndex].id);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {selected ? (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary"
            aria-label="Selected student"
            onClick={() => setOpen(true)}
          >
            <User size={12} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl bg-surface-container-lowest py-2 shadow-[0_12px_32px_rgba(4,22,39,0.12)] ring-1 ring-outline-variant"
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-body-md text-on-surface-variant">
              No students match that name
            </li>
          ) : (
            results.map((student, index) => (
              <li key={student.id} role="option" aria-selected={student.id === selectedId}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-body-md ${
                    index === activeIndex
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface hover:bg-surface-container"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(student.id)}
                >
                  <span>{student.name}</span>
                  {student.id === selectedId ? (
                    <Check size={14} strokeWidth={1.75} aria-hidden />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
