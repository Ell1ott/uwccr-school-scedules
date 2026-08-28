import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { BLOCK_LETTERS, offeringsForCohort } from "../lib/classCatalog";
import { matchesQuery } from "../lib/people";
import { COHORTS } from "../lib/school";
import type { EventTarget } from "../lib/schoolEvents";
import { expandAudience } from "../lib/schoolEvents";
import type { BlockLetter, CohortId, Student } from "../types";

export function AudiencePicker({
  students,
  targets,
  onChange,
}: {
  students: Student[];
  targets: EventTarget[];
  onChange: (targets: EventTarget[]) => void;
}) {
  const [cohort, setCohort] = useState<CohortId>("IB1");
  const [block, setBlock] = useState<BlockLetter>("A");
  const [query, setQuery] = useState("");
  const catalog = useMemo(
    () => offeringsForCohort(students, cohort),
    [students, cohort],
  );
  const pickedIds = new Set(
    targets
      .filter((target) => target.kind === "student")
      .map((target) => target.payload.student_id),
  );
  const matches = useMemo(
    () =>
      students
        .filter((student) => matchesQuery(student.name, query))
        .slice(0, 8),
    [students, query],
  );
  const count = expandAudience(students, targets).length;

  function hasAll() {
    return targets.some((target) => target.kind === "all_students");
  }
  function hasCohort(id: CohortId) {
    return targets.some(
      (target) => target.kind === "cohort" && target.payload.cohort === id,
    );
  }
  function toggleAll() {
    onChange(
      hasAll()
        ? targets.filter((target) => target.kind !== "all_students")
        : [...targets.filter((target) => target.kind !== "cohort"), { kind: "all_students", payload: {} }],
    );
  }
  function toggleCohort(id: CohortId) {
    if (hasCohort(id)) {
      onChange(
        targets.filter(
          (target) => !(target.kind === "cohort" && target.payload.cohort === id),
        ),
      );
      return;
    }
    onChange([
      ...targets.filter((target) => target.kind !== "all_students"),
      { kind: "cohort", payload: { cohort: id } },
    ]);
  }
  function addClass(offering: {
    subject: string;
    level: string;
    teacher: string;
    room: string;
  }) {
    const next: EventTarget = {
      kind: "academic_class",
      payload: { block, ...offering },
    };
    const key = JSON.stringify(next);
    if (targets.some((target) => JSON.stringify(target) === key)) return;
    onChange([...targets, next]);
  }
  function toggleStudent(id: string) {
    if (pickedIds.has(id)) {
      onChange(
        targets.filter(
          (target) =>
            !(target.kind === "student" && target.payload.student_id === id),
        ),
      );
      return;
    }
    onChange([...targets, { kind: "student", payload: { student_id: id } }]);
  }
  function removeAt(index: number) {
    onChange(targets.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`h-9 rounded-full px-3 text-label-sm tracking-wide ${
            hasAll()
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface"
          }`}
          onClick={toggleAll}
        >
          All students
        </button>
        {COHORTS.map((id) => (
          <button
            key={id}
            type="button"
            className={`h-9 rounded-full px-3 text-label-sm tracking-wide ${
              hasCohort(id)
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface"
            }`}
            onClick={() => toggleCohort(id)}
          >
            {id}
          </button>
        ))}
      </div>

      <div>
        <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          Academic class
        </p>
        <div className="mt-2 flex gap-2">
          {COHORTS.map((id) => (
            <button
              key={id}
              type="button"
              className={`h-9 rounded-full px-3 text-label-sm ${
                cohort === id
                  ? "bg-surface-container-highest text-on-surface"
                  : "bg-surface-container text-on-surface-variant"
              }`}
              onClick={() => setCohort(id)}
            >
              {id}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {BLOCK_LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              className={`size-8 rounded-full text-label-sm ${
                block === letter
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant"
              }`}
              onClick={() => setBlock(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
        <ul className="mt-2 max-h-40 overflow-auto rounded-2xl bg-surface-container">
          {catalog[block].map((offering) => (
            <li key={`${offering.subject}-${offering.level}-${offering.teacher}`}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-body-md"
                onClick={() => addClass(offering)}
              >
                <span>
                  {offering.subject} {offering.level}
                  <span className="ml-2 text-label-sm text-on-surface-variant">
                    {offering.teacher}
                  </span>
                </span>
                <span className="text-label-sm text-on-surface-variant">
                  {offering.studentCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Individual students
        <input
          type="search"
          value={query}
          placeholder="Search names"
          onChange={(event) => setQuery(event.target.value)}
          className="mt-2 h-11 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>
      {query.trim() ? (
        <ul className="rounded-2xl bg-surface-container">
          {matches.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-body-md"
                onClick={() => toggleStudent(student.id)}
              >
                <span>
                  {student.name}
                  <span className="ml-2 text-label-sm text-on-surface-variant">
                    {student.cohort}
                  </span>
                </span>
                <span className="text-label-sm text-on-surface-variant">
                  {pickedIds.has(student.id) ? "Added" : "Add"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {targets.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {targets.map((target, index) => (
            <li
              key={`${target.kind}-${index}`}
              className="flex items-center gap-1 rounded-full bg-surface-container px-3 py-1 text-label-sm"
            >
              <span>{targetLabel(target, students)}</span>
              <button
                type="button"
                aria-label="Remove"
                className="flex size-6 items-center justify-center"
                onClick={() => removeAt(index)}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-label-sm text-on-surface-variant">
        {count === 1 ? "1 student" : `${count} students`} on the list
      </p>
    </div>
  );
}

function targetLabel(target: EventTarget, students: Student[]): string {
  if (target.kind === "all_students") return "All students";
  if (target.kind === "cohort") return target.payload.cohort;
  if (target.kind === "academic_class") {
    const p = target.payload;
    return `${p.subject} ${p.level} · ${p.block}`;
  }
  if (target.kind === "student") {
    return students.find((student) => student.id === target.payload.student_id)
      ?.name ?? "Student";
  }
  return "House";
}
