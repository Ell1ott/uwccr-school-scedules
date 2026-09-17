import { BookOpen, Check, Search, Users, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { initials } from "../lib/classDetail";
import {
  offeringsForCohort,
  offeringKey,
  type ClassOffering,
} from "../lib/classCatalog";
import { compareLabels, compareNames, searchPeople } from "../lib/people";
import { BLOCK_LETTERS, COHORTS } from "../lib/school";
import type { EventTarget } from "../lib/schoolEvents";
import type { BlockLetter, CohortId, Student } from "../types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "groups", label: "Groups" },
  { id: "classes", label: "Classes" },
  { id: "people", label: "People" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];
type Bucket = "groups" | "classes" | "people";

type Hit = {
  id: string;
  bucket: Bucket;
  name: string;
  hint: string;
  count: number | null;
  target: EventTarget;
  searchKeys: string[];
};

const EMPTY_LIMITS: Record<FilterId, number | null> = {
  all: 12,
  groups: null,
  classes: 40,
  people: 24,
};

const SEARCH_LIMITS: Record<Bucket, number> = {
  groups: 8,
  classes: 12,
  people: 12,
};

function targetKey(target: EventTarget): string {
  if (target.kind === "all_students") return "all";
  if (target.kind === "cohort") return `cohort:${target.payload.cohort}`;
  if (target.kind === "student") return `student:${target.payload.student_id}`;
  if (target.kind === "academic_class") {
    return `class:${target.payload.block}:${offeringKey(target.payload)}`;
  }
  return `house:${target.payload.house_id}`;
}

function hasTarget(targets: EventTarget[], target: EventTarget): boolean {
  const key = targetKey(target);
  return targets.some((item) => targetKey(item) === key);
}

function classCatalog(students: Student[]) {
  const map = new Map<
    string,
    {
      offering: ClassOffering;
      block: BlockLetter;
      cohorts: CohortId[];
    }
  >();
  for (const cohort of COHORTS) {
    const catalog = offeringsForCohort(students, cohort);
    for (const block of BLOCK_LETTERS) {
      for (const offering of catalog[block]) {
        const id = `${block}:${offeringKey(offering)}`;
        const existing = map.get(id);
        if (existing) {
          if (!existing.cohorts.includes(cohort)) existing.cohorts.push(cohort);
        } else {
          map.set(id, { offering, block, cohorts: [cohort] });
        }
      }
    }
  }
  return [...map.entries()].map(([id, item]) => ({ id, ...item }));
}

function buildHits(students: Student[]): Record<Bucket, Hit[]> {
  const cohortCounts = Object.fromEntries(
    COHORTS.map((id) => [
      id,
      students.filter((student) => student.cohort === id).length,
    ]),
  ) as Record<CohortId, number>;

  const groups: Hit[] = [
    {
      id: "all",
      bucket: "groups",
      name: "All students",
      hint: "Everyone",
      count: students.length,
      target: { kind: "all_students", payload: {} },
      searchKeys: ["everyone", "all", "whole school", "students"],
    },
    ...COHORTS.map((id) => ({
      id,
      bucket: "groups" as const,
      name: id,
      hint: "Year group",
      count: cohortCounts[id],
      target: { kind: "cohort" as const, payload: { cohort: id } },
      searchKeys: [id, `${id} year`, "year", "cohort"],
    })),
  ];

  const classes: Hit[] = classCatalog(students)
    .map((item) => {
      const name = `${item.offering.subject} ${item.offering.level}`.trim();
      const cohorts = item.cohorts.join(" · ");
      return {
        id: item.id,
        bucket: "classes" as const,
        name,
        hint: `Block ${item.block} · ${cohorts} · ${item.offering.teacher}`,
        count: item.offering.studentCount,
        target: {
          kind: "academic_class" as const,
          payload: {
            block: item.block,
            subject: item.offering.subject,
            level: item.offering.level,
            teacher: item.offering.teacher,
            room: item.offering.room,
          },
        },
        searchKeys: [
          item.offering.subject,
          item.offering.level,
          item.offering.teacher,
          item.block,
          `block ${item.block}`,
          cohorts,
          "class",
        ],
      };
    })
    .sort(
      (a, b) =>
        compareLabels(a.name, b.name) || compareLabels(a.hint, b.hint),
    );

  const people: Hit[] = [...students]
    .sort((a, b) => compareNames(a.name, b.name))
    .map((student) => ({
      id: student.id,
      bucket: "people" as const,
      name: student.name,
      hint: student.cohort,
      count: null,
      target: { kind: "student" as const, payload: { student_id: student.id } },
      searchKeys: [student.cohort, student.name],
    }));

  return { groups, classes, people };
}

function searchBucket(hits: Hit[], query: string): Hit[] {
  return searchPeople(hits, query, [(hit) => hit.searchKeys.join(" ")]);
}

function targetLabel(target: EventTarget, students: Student[]): string {
  if (target.kind === "all_students") return "All students";
  if (target.kind === "cohort") return target.payload.cohort;
  if (target.kind === "academic_class") {
    const payload = target.payload;
    return `${payload.subject} ${payload.level} · ${payload.block}`;
  }
  if (target.kind === "student") {
    return (
      students.find((student) => student.id === target.payload.student_id)
        ?.name ?? "Student"
    );
  }
  return "House";
}

export function AudiencePicker({
  students,
  targets,
  onChange,
}: {
  students: Student[];
  targets: EventTarget[];
  onChange: (targets: EventTarget[]) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const catalog = useMemo(() => buildHits(students), [students]);

  const results = useMemo(() => {
    const q = query.trim();
    const buckets: Bucket[] =
      filter === "all" ? ["groups", "classes", "people"] : [filter];
    const limit = q ? null : EMPTY_LIMITS[filter];

    const rows: Hit[] = [];
    for (const bucket of buckets) {
      if (filter === "all" && !q && bucket !== "groups") continue;
      const pool = catalog[bucket];
      const found = q ? searchBucket(pool, q) : pool;
      const cap = q ? SEARCH_LIMITS[bucket] : limit;
      const slice =
        cap == null || (bucket === "groups" && !q)
          ? found
          : found.slice(0, cap);
      rows.push(...slice);
    }
    return rows;
  }, [catalog, filter, query]);

  function setFilterId(id: FilterId) {
    setFilter(id);
    setActiveIndex(0);
  }

  function toggle(target: EventTarget) {
    if (target.kind === "all_students") {
      onChange(hasTarget(targets, target) ? [] : [target]);
      return;
    }
    const withoutAll = targets.filter((item) => item.kind !== "all_students");
    if (hasTarget(withoutAll, target)) {
      onChange(
        withoutAll.filter((item) => targetKey(item) !== targetKey(target)),
      );
      return;
    }
    let next = [...withoutAll, target];
    const pickedCohorts = new Set(
      next
        .filter((item) => item.kind === "cohort")
        .map((item) => item.payload.cohort),
    );
    if (COHORTS.every((id) => pickedCohorts.has(id))) {
      next = [{ kind: "all_students", payload: {} }];
    }
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(targets.filter((_, item) => item !== index));
  }

  const sections = FILTERS.filter((item) => item.id !== "all").filter((item) =>
    results.some((hit) => hit.bucket === item.id),
  );

  return (
    <div className="flex flex-col gap-3">
      {targets.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {targets.map((target, index) => (
            <li key={targetKey(target)}>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full bg-surface-container py-1 pr-1.5 pl-3 text-label-sm tracking-wide"
                onClick={() => removeAt(index)}
              >
                {targetLabel(target, students)}
                <span className="flex size-6 items-center justify-center">
                  <X size={12} strokeWidth={2} aria-hidden />
                </span>
                <span className="sr-only">Remove</span>
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
          type="search"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder="Search groups, classes, people"
          className="h-12 w-full bg-transparent text-body-md outline-none placeholder:text-on-surface-variant/70"
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
              toggle(results[activeIndex].target);
            } else if (
              event.key === "Backspace" &&
              !query &&
              targets.length
            ) {
              removeAt(targets.length - 1);
            }
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Audience filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={filter === item.id}
            className={`h-9 rounded-full px-3 text-label-sm tracking-wide ${
              filter === item.id
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface"
            }`}
            onClick={() => setFilterId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ul
        id={listId}
        role="listbox"
        className="max-h-72 overflow-auto rounded-2xl bg-surface-container py-1"
      >
        {results.length === 0 ? (
          <li className="px-4 py-3 text-body-md text-on-surface-variant">
            {query.trim() ? "Nothing matches that" : "Nothing to show"}
          </li>
        ) : (
          results.map((hit, index) => {
            const selected = hasTarget(targets, hit.target);
            const showHeading =
              filter === "all" &&
              (index === 0 || results[index - 1]?.bucket !== hit.bucket);
            const heading = sections.find((item) => item.id === hit.bucket)?.label;
            return (
              <li key={hit.id}>
                {showHeading && heading ? (
                  <p className="px-4 pt-2 pb-1 text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                    {heading}
                  </p>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    index === activeIndex
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => toggle(hit.target)}
                >
                  {hit.bucket === "people" ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-[10px] font-semibold">
                      {initials(hit.name)}
                    </span>
                  ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">
                      {hit.bucket === "groups" ? (
                        <Users size={14} strokeWidth={1.75} aria-hidden />
                      ) : (
                        <BookOpen size={14} strokeWidth={1.75} aria-hidden />
                      )}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-md">{hit.name}</span>
                    <span className="block truncate text-label-sm text-on-surface-variant">
                      {hit.hint}
                    </span>
                  </span>
                  {selected ? (
                    <Check
                      size={16}
                      strokeWidth={1.75}
                      className="shrink-0"
                      aria-hidden
                    />
                  ) : hit.count != null ? (
                    <span className="text-label-sm text-on-surface-variant">
                      {hit.count}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
        {filter === "all" && !query.trim() ? (
          <li className="px-4 pt-1 pb-3 text-label-sm text-on-surface-variant">
            Type a class or a name, or filter above.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
