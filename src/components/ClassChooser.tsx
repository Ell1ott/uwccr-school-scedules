import { CircleAlert, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { academicRowsFor, DAYS } from "../data/weekTemplate";
import { track } from "../lib/analytics";
import { formatTime } from "../lib/buildSchedule";
import {
  BLOCK_LETTERS,
  countLevels,
  keepOfferedPicks,
  offeringKey,
  offeringsForCohort,
  issuesByBlock,
  seedBlocksFromStudent,
  toClassEntry,
  validateChooser,
  type ClassOffering,
} from "../lib/classCatalog";
import { meetingsForBlock } from "../lib/classDetail";
import { usePalette } from "../lib/palette";
import { toneForEvent, type Tone } from "../lib/tones";
import type {
  BlockLetter,
  ClassEntry,
  CohortId,
  ScheduleEvent,
  Student,
} from "../types";
import { FloatingTabs } from "./FloatingTabs";

const COHORTS: CohortId[] = ["IB1", "IB2"];
const COHORT_TABS = COHORTS.map((id) => ({ id, label: id }));

function toneEvent(kind: "class" | "study", title: string): ScheduleEvent {
  return {
    id: title,
    start: "00:00",
    end: "00:00",
    startMin: 0,
    endMin: 0,
    kind,
    title,
  };
}

function meetingLabel(block: BlockLetter, communityMeeting: boolean): string {
  const meetings = meetingsForBlock(block, communityMeeting);
  const first = meetings[0];
  if (!first) return `Block ${block}`;
  return `${first.dayShort} ${formatTime(first.start)}`;
}

function enrollmentLabel(count: number): string {
  return count === 1 ? "1 student" : `${count} students`;
}

function EnrollmentMark({
  count,
  muted,
}: {
  count: number;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium tabular-nums ${
        muted ? "opacity-80" : "text-on-surface-variant"
      }`}
    >
      <Users size={10} strokeWidth={1.75} aria-hidden />
      {count}
    </span>
  );
}

export function ClassChooser({
  students,
  currentStudent,
  communityMeeting = false,
  onClose,
}: {
  students: Student[];
  currentStudent?: Student;
  communityMeeting?: boolean;
  onClose: () => void;
}) {
  const { palette } = usePalette();
  const onCloseRef = useRef(onClose);
  const [cohort, setCohort] = useState<CohortId | null>(
    () => currentStudent?.cohort ?? null,
  );
  const [blocks, setBlocks] = useState<Partial<Record<BlockLetter, ClassEntry>>>(
    () => (currentStudent ? seedBlocksFromStudent(currentStudent) : {}),
  );

  const catalog = useMemo(
    () => (cohort ? offeringsForCohort(students, cohort) : null),
    [students, cohort],
  );
  const counts = useMemo(() => countLevels(blocks), [blocks]);
  const issues = useMemo(
    () => (cohort ? validateChooser(blocks) : []),
    [cohort, blocks],
  );
  const flaggedBlocks = useMemo(
    () => (cohort ? issuesByBlock(blocks) : {}),
    [cohort, blocks],
  );
  const academicRows = useMemo(
    () => academicRowsFor(communityMeeting),
    [communityMeeting],
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    window.scrollTo(0, 0);

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function chooseCohort(next: CohortId) {
    setCohort(next);
    track("class_chooser_cohort_picked", { cohort: next });
    if (currentStudent?.cohort === next) {
      setBlocks(seedBlocksFromStudent(currentStudent));
      return;
    }
    const nextCatalog = offeringsForCohort(students, next);
    setBlocks((prev) => keepOfferedPicks(prev, nextCatalog));
  }

  function selectOffering(block: BlockLetter, offering: ClassOffering) {
    const current = blocks[block];
    const cleared = Boolean(
      current && offeringKey(current) === offeringKey(offering),
    );
    track("class_chooser_block_swapped", {
      block,
      subject: offering.subject,
      cleared,
    });
    setBlocks((prev) => {
      if (cleared) {
        const next = { ...prev };
        delete next[block];
        return next;
      }
      return { ...prev, [block]: toClassEntry(offering) };
    });
  }

  function clearBlock(block: BlockLetter) {
    setBlocks((prev) => {
      const next = { ...prev };
      delete next[block];
      return next;
    });
  }

  return (
    <div className="flex h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))] flex-col overflow-hidden text-on-surface">
      <h1 className="sr-only">Try classes</h1>
      <div className="shrink-0 px-container-padding-mobile pt-4 pb-3 md:px-container-padding-desktop">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-container px-3 py-2.5">
          <FloatingTabs
            ariaLabel="Year"
            value={cohort}
            options={COHORT_TABS}
            onChange={chooseCohort}
          />
          {cohort ? (
            <>
              <CountPill label="HL" value={counts.HL} target={3} />
              <CountPill label="SL" value={counts.SL} target={3} />
              <CountPill label="TOK" value={counts.TOK} target={1} />
            </>
          ) : null}
          <p className="text-[13px] leading-5 text-on-surface-variant">
            Preview only. Nothing is saved to anyone's real schedule.
          </p>
        </div>
      </div>

      {issues.length > 0 ? (
        <div
          role="alert"
          className="shrink-0 border-b border-error/15 bg-error-container px-container-padding-desktop py-2.5 text-[13px] leading-5 text-on-error-container"
        >
          {issues.join(" ")}
        </div>
      ) : null}

      {!cohort ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="max-w-sm text-center text-body-md text-on-surface-variant">
            Choose IB1 or IB2 to see the classes offered in each block.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <AcademicPreview
            rows={academicRows}
            blocks={blocks}
            palette={palette}
          />
          <div className="min-h-0 flex-1 overflow-auto px-container-padding-desktop pb-6">
            <div className="flex min-w-[72rem] items-start gap-2.5 pt-4">
              {BLOCK_LETTERS.map((block) => (
                <BlockColumn
                  key={block}
                  block={block}
                  offerings={catalog?.[block] ?? []}
                  selected={blocks[block]}
                  issue={flaggedBlocks[block]}
                  communityMeeting={communityMeeting}
                  palette={palette}
                  onSelect={(offering) => selectOffering(block, offering)}
                  onClear={() => clearBlock(block)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CountPill({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target: number;
}) {
  const ok = value === target;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide tabular-nums ${
        ok
          ? "bg-surface-container text-on-surface-variant"
          : "bg-error-container text-on-error-container"
      }`}
    >
      {label} {value}/{target}
    </span>
  );
}

function AcademicPreview({
  rows,
  blocks,
  palette,
}: {
  rows: ReturnType<typeof academicRowsFor>;
  blocks: Partial<Record<BlockLetter, ClassEntry>>;
  palette: Parameters<typeof toneForEvent>[1];
}) {
  return (
    <div className="shrink-0 overflow-x-auto border-b border-outline-variant/60 px-container-padding-desktop py-3">
      <div className="grid min-w-[40rem] grid-cols-[4.25rem_repeat(5,minmax(0,1fr))] gap-1.5">
        <div />
        {DAYS.map((day) => (
          <div
            key={day.id}
            className="text-center text-[10px] font-medium tracking-[0.14em] text-on-surface-variant uppercase"
          >
            {day.short}
          </div>
        ))}
        {rows.map((row) => (
          <div key={row.start} className="contents">
            <div className="self-center text-right text-[10px] leading-3 font-medium text-on-surface-variant/70 tabular-nums">
              {formatTime(row.start)}
            </div>
            {DAYS.map((day) => {
              const block = row.blocks[day.id];
              if (!block) return <div key={day.id} />;
              const entry = blocks[block];
              if (!entry) {
                return (
                  <div
                    key={day.id}
                    className="flex h-11 items-center justify-between gap-1 rounded-lg px-2 text-[11px] text-on-surface-variant/55"
                  >
                    <span className="truncate">Study</span>
                    <span className="shrink-0 text-[10px]">{block}</span>
                  </div>
                );
              }
              const tone = toneForEvent(toneEvent("class", entry.subject), palette);
              return (
                <div
                  key={day.id}
                  className={`flex h-11 items-center justify-between gap-1 rounded-lg px-2 text-[11px] leading-4 font-medium ${tone.bg} ${tone.text}`}
                  style={tone.bgColor ? { backgroundColor: tone.bgColor } : undefined}
                >
                  <span className="min-w-0 truncate">{entry.subject}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-px text-[9px] ${tone.chip}`}>
                    {entry.level} · {block}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockColumn({
  block,
  offerings,
  selected,
  issue,
  communityMeeting,
  palette,
  onSelect,
  onClear,
}: {
  block: BlockLetter;
  offerings: ClassOffering[];
  selected?: ClassEntry;
  issue?: string;
  communityMeeting: boolean;
  palette: Parameters<typeof toneForEvent>[1];
  onSelect: (offering: ClassOffering) => void;
  onClear: () => void;
}) {
  const selectedTone = selected
    ? toneForEvent(toneEvent("class", selected.subject), palette)
    : undefined;
  const selectedCount = selected
    ? offerings.find((offering) => offeringKey(offering) === offeringKey(selected))
        ?.studentCount
    : undefined;

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 bg-surface pb-2">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <h3 className="flex min-w-0 items-center gap-1 text-label-sm tracking-[0.12em] text-on-surface uppercase">
            Block {block}
            {issue ? (
              <CircleAlert
                size={12}
                strokeWidth={2.25}
                className="shrink-0 text-error"
                aria-label={issue}
              />
            ) : null}
          </h3>
          <span className="shrink-0 text-[10px] font-medium tracking-wide text-on-surface-variant tabular-nums">
            {meetingLabel(block, communityMeeting)}
          </span>
        </div>
        {selected && selectedTone ? (
          <button
            type="button"
            className={`w-full rounded-[12px] px-3 py-2.5 text-left ${selectedTone.bg} ${selectedTone.text} hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
            style={
              selectedTone.bgColor
                ? { backgroundColor: selectedTone.bgColor }
                : undefined
            }
            aria-label={`Clear ${selected.subject} from block ${block}${
              selectedCount != null ? `, ${enrollmentLabel(selectedCount)}` : ""
            }`}
            onClick={onClear}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] leading-4 font-semibold">{selected.subject}</p>
              <span
                className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${selectedTone.chip}`}
              >
                {selected.level}
              </span>
            </div>
            <p className="mt-1 flex items-center justify-between gap-2 text-[11px] leading-4 opacity-80">
              <span className="min-w-0 truncate">
                {selected.teacher}
                {selected.room ? ` · Rm ${selected.room}` : ""}
              </span>
              {selectedCount != null ? (
                <EnrollmentMark count={selectedCount} muted />
              ) : null}
            </p>
          </button>
        ) : (
          <div className="rounded-[12px] border border-dashed border-outline-variant px-3 py-2.5">
            <p className="text-[13px] leading-4 font-medium text-on-surface-variant">
              Study period
            </p>
            <p className="mt-0.5 text-[11px] text-on-surface-variant/70">
              Pick a class below
            </p>
          </div>
        )}
      </div>
      <ul className="space-y-1 pr-0.5">
        {offerings.map((offering) => (
          <OfferingButton
            key={offeringKey(offering)}
            offering={offering}
            selected={
              selected ? offeringKey(selected) === offeringKey(offering) : false
            }
            tone={toneForEvent(toneEvent("class", offering.subject), palette)}
            onSelect={() => onSelect(offering)}
          />
        ))}
      </ul>
    </section>
  );
}

function OfferingButton({
  offering,
  selected,
  tone,
  onSelect,
}: {
  offering: ClassOffering;
  selected: boolean;
  tone: Tone;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${offering.subject}, ${offering.level}, ${offering.teacher}${
          offering.room ? `, room ${offering.room}` : ""
        }, ${enrollmentLabel(offering.studentCount)}`}
        className={`flex w-full items-start justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
          selected
            ? `${tone.bg} ${tone.text}`
            : "bg-surface-container text-on-surface hover:bg-surface-container-high"
        }`}
        style={
          selected && tone.bgColor
            ? { backgroundColor: tone.bgColor }
            : undefined
        }
        onClick={onSelect}
      >
        <span className="min-w-0">
          <span className="block truncate text-[12px] leading-4 font-medium">
            {offering.subject}
          </span>
          <span
            className={`mt-0.5 block truncate text-[10px] leading-3 ${
              selected ? "opacity-80" : "text-on-surface-variant"
            }`}
          >
            {offering.teacher}
            {offering.room ? ` · Rm ${offering.room}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-1.5 py-px text-[10px] font-medium ${
              selected ? tone.chip : "bg-surface-container-lowest text-on-surface-variant"
            }`}
          >
            {offering.level}
          </span>
          <EnrollmentMark count={offering.studentCount} muted={selected} />
        </span>
      </button>
    </li>
  );
}
