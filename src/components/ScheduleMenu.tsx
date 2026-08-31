import { MessageSquare, Shuffle, Sparkles, X } from "lucide-react";
import { useId } from "react";
import type { SelectedPerson, Student, Teacher } from "../types";
import { useAuth } from "../lib/auth";
import { cohortCaption, teacherCaption } from "../lib/cohort";
import { selectedStudent } from "../lib/people";
import { BottomSheet, SheetHandle } from "./BottomSheet";
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
  onOpenEvents,
  onOpenFeedback,
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
  onOpenEvents?: () => void;
  onOpenFeedback?: () => void;
}) {
  const auth = useAuth();
  const titleId = useId();
  const student = selectedStudent(students, selected);

  const caption =
    selected?.kind === "teacher"
      ? teacherCaption(weekStart)
      : student
        ? cohortCaption(student.cohort, weekStart)
        : "IB1 & IB2 2026–2027";

  return (
    <BottomSheet
      labelledBy={titleId}
      overlayLabel="Close menu"
      onClose={onClose}
    >
      {(closeRef) => (
        <>
          <div className="px-5 pt-2 pb-4">
            <SheetHandle />
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

            {onOpenEvents ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                  After classes
                </h3>
                <button
                  type="button"
                  className="flex h-12 items-center gap-2 rounded-full bg-surface-container px-4 text-left text-label-sm tracking-wide text-on-surface"
                  onClick={() => {
                    onOpenEvents();
                    onClose();
                  }}
                >
                  <Sparkles size={16} strokeWidth={1.75} aria-hidden />
                  Events
                </button>
              </section>
            ) : null}

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

            {onOpenFeedback ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                  Help
                </h3>
                <button
                  type="button"
                  className="flex h-12 items-center gap-2 rounded-full bg-surface-container px-4 text-left text-label-sm tracking-wide text-on-surface"
                  onClick={() => {
                    onOpenFeedback();
                    onClose();
                  }}
                >
                  <MessageSquare size={16} strokeWidth={1.75} aria-hidden />
                  Send feedback
                </button>
              </section>
            ) : null}

            <section className="flex flex-col gap-2 pb-2">
              <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                Account
              </h3>
              {auth.displayName ? (
                <button
                  type="button"
                  className="h-12 rounded-full bg-surface-container px-4 text-left text-label-sm tracking-wide text-on-surface"
                  onClick={() => {
                    void auth.signOut();
                    onClose();
                  }}
                >
                  Sign out {auth.displayName}
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
                  Log in
                </button>
              )}
              {import.meta.env.VITE_SHOW_SEND_LOGINS ? (
                <button
                  type="button"
                  className="h-12 rounded-full px-4 text-left text-label-sm tracking-wide text-on-surface-variant"
                  onClick={() => {
                    onOpenAdmin?.();
                    onClose();
                  }}
                >
                  Send logins
                </button>
              ) : null}
            </section>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
