import { Shuffle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { SelectedPerson, Student, Teacher } from "../types";
import { cohortCaption, teacherCaption } from "../lib/cohort";
import { useAuth } from "../lib/auth";
import { PalettePicker } from "./PalettePicker";
import { StudentPicker } from "./StudentPicker";
import { WeekNav } from "./WeekNav";

export function ScheduleMenu({
  students,
  teachers,
  selected,
  weekStart,
  onSelect,
  onWeekChange,
  onClose,
  onOpenLogin,
  onOpenAdmin,
  onOpenChooser,
}: {
  students: Student[];
  teachers: Teacher[];
  selected: SelectedPerson | null;
  weekStart: string;
  onSelect: (person: SelectedPerson) => void;
  onWeekChange: (weekStart: string) => void;
  onClose: () => void;
  onOpenLogin?: () => void;
  onOpenAdmin?: () => void;
  onOpenChooser?: () => void;
}) {
  const auth = useAuth();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const selectedStudent =
    selected?.kind === "student"
      ? students.find((item) => item.id === selected.id)
      : undefined;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  const caption =
    selected?.kind === "teacher"
      ? teacherCaption(weekStart)
      : selectedStudent
        ? cohortCaption(selectedStudent.cohort, weekStart)
        : "IB1 & IB2 2026–2027";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button
        type="button"
        className="sheet-overlay absolute inset-0 bg-primary/45"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-panel relative z-10 flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] bg-surface-container-lowest shadow-[0_-12px_48px_rgba(4,22,39,0.18)]"
      >
        <div className="px-5 pt-2 pb-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-on-surface/20" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-title-md tracking-tight">
                Week View
              </h2>
              <p className="mt-0.5 text-label-sm text-on-surface-variant">
                {caption}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              aria-label="Close menu"
              onClick={onClose}
            >
              <X size={18} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        <div className="sheet-scroll flex flex-col gap-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          <section className="flex flex-col gap-2">
            <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Search
            </h3>
            <StudentPicker
              students={students}
              teachers={teachers}
              selected={selected}
              inlineList
              fieldClassName="h-12 bg-surface-container px-4"
              onSelect={(person) => {
                onSelect(person);
                onClose();
              }}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Week
            </h3>
            <WeekNav
              weekStart={weekStart}
              onChange={onWeekChange}
              showLabel
              className="h-12 w-full justify-between px-2"
            />
          </section>

          {onOpenChooser ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                Classes
              </h3>
              <button
                type="button"
                className="flex h-12 items-center gap-2 rounded-full bg-surface-container px-4 text-left text-label-sm tracking-wide text-on-surface"
                onClick={() => {
                  onOpenChooser();
                  onClose();
                }}
              >
                <Shuffle size={16} strokeWidth={1.75} aria-hidden />
                Try classes
              </button>
            </section>
          ) : null}

          <section className="flex flex-col gap-2 pb-2">
            <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Look
            </h3>
            <PalettePicker
              showLabel
              inlineList
              className="w-full"
              buttonClassName="h-12 w-full justify-between bg-surface-container px-4"
            />
          </section>

          <section className="flex flex-col gap-2 pb-2">
            <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Staff
            </h3>
            {auth.teacherName ? (
              <button
                type="button"
                className="h-12 rounded-full bg-surface-container px-4 text-left text-label-sm tracking-wide text-on-surface"
                onClick={() => {
                  void auth.signOut();
                  onClose();
                }}
              >
                Sign out {auth.teacherName}
              </button>
            ) : (
              <button
                type="button"
                className="h-12 rounded-full bg-surface-container px-4 text-left text-label-sm tracking-wide text-on-surface"
                onClick={() => {
                  onOpenLogin?.();
                  onClose();
                }}
              >
                Teacher login
              </button>
            )}
            <button
              type="button"
              className="h-12 rounded-full px-4 text-left text-label-sm tracking-wide text-on-surface-variant"
              onClick={() => {
                onOpenAdmin?.();
                onClose();
              }}
            >
              Send teacher logins
            </button>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
