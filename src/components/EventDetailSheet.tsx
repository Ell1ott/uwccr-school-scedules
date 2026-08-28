import { Calendar, MapPin, Users } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { track } from "../lib/analytics";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/classDetail";
import { usePalette } from "../lib/palette";
import { findById } from "../lib/people";
import {
  cancelSchoolEvent,
  fetchEventResponses,
  formatEventWhen,
  joinSchoolEvent,
  leaveSchoolEvent,
  respondToInvite,
  rsvpLabel,
  type EventResponseRow,
  type SchoolEvent,
} from "../lib/schoolEvents";
import { toneForEvent } from "../lib/tones";
import type { Student } from "../types";
import { DetailSheet, SheetFact } from "./BottomSheet";

export function EventDetailSheet({
  event,
  students,
  onClose,
  onEdit,
}: {
  event: SchoolEvent;
  students: Student[];
  onClose: () => void;
  onEdit?: () => void;
}) {
  const auth = useAuth();
  const { palette } = usePalette();
  const tone = toneForEvent(
    {
      id: event.id,
      kind: "school_event",
      title: event.title,
      start: "",
      end: "",
      startMin: 0,
      endMin: 0,
    },
    palette,
  );
  const titleId = useId();
  const mine = auth.profileId === event.createdBy;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<EventResponseRow[] | null>(null);

  useEffect(() => {
    track("school_event_opened", { event_id: event.id, mode: event.mode });
  }, [event.id, event.mode]);

  useEffect(() => {
    if (!mine && auth.role !== "staff") return;
    let active = true;
    fetchEventResponses(event.id).then((rows) => {
      if (active) setResponses(rows);
    });
    return () => {
      active = false;
    };
  }, [event.id, mine, auth.role]);

  const grouped = useMemo(() => {
    if (!responses) return null;
    const buckets: Record<string, EventResponseRow[]> = {
      going: [],
      pending: [],
      waitlisted: [],
      declined: [],
    };
    for (const row of responses) {
      (buckets[row.status] ?? buckets.pending).push(row);
    }
    return buckets;
  }, [responses]);

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const message = await action();
    setBusy(false);
    if (message) setError(message);
  }

  const studentCanAct = auth.role === "student" && event.status === "published";
  const capacityLine =
    event.mode === "open" && event.capacity != null
      ? `${event.goingCount} going${
          event.waitlistedCount > 0 ? ` · ${event.waitlistedCount} waitlisted` : ""
        } · ${event.capacity} spots`
      : null;

  return (
    <DetailSheet
      labelledBy={titleId}
      overlayLabel="Close event"
      onClose={onClose}
      tone={tone}
      kicker={event.status === "cancelled" ? "Event · Cancelled" : "Event"}
      title={<span>{event.title}</span>}
      chip={rsvpLabel(event)}
    >
      <dl className="grid grid-cols-2 gap-3">
        <SheetFact
          label="When"
          value={formatEventWhen(event)}
          icon={<Calendar size={14} strokeWidth={1.75} />}
        />
        <SheetFact
          label="Where"
          value={event.location || "—"}
          icon={<MapPin size={14} strokeWidth={1.75} />}
        />
      </dl>

      {event.description ? (
        <p className="mt-6 whitespace-pre-wrap text-body-md">{event.description}</p>
      ) : null}

      {capacityLine ? (
        <p className="mt-4 text-label-sm text-on-surface-variant">{capacityLine}</p>
      ) : null}

      {studentCanAct && event.mode === "invite" ? (
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={busy}
            className="h-12 flex-1 rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
            onClick={() => void run(() => respondToInvite(event.id, "going"))}
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            className="h-12 flex-1 rounded-full bg-surface-container text-label-sm tracking-wide disabled:opacity-50"
            onClick={() => void run(() => respondToInvite(event.id, "declined"))}
          >
            Decline
          </button>
        </div>
      ) : null}

      {studentCanAct && event.mode === "open" ? (
        event.myStatus === "going" || event.myStatus === "waitlisted" ? (
          <button
            type="button"
            disabled={busy}
            className="mt-6 h-12 w-full rounded-full bg-surface-container text-label-sm tracking-wide disabled:opacity-50"
            onClick={() => void run(() => leaveSchoolEvent(event.id))}
          >
            Leave
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
            onClick={() =>
              void run(async () => {
                const result = await joinSchoolEvent(event.id);
                return result.error;
              })
            }
          >
            Join
          </button>
        )
      ) : null}

      {mine ? (
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide"
            onClick={onEdit}
          >
            Edit this occurrence
          </button>
          <button
            type="button"
            disabled={busy || event.status === "cancelled"}
            className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide disabled:opacity-50"
            onClick={() => void run(() => cancelSchoolEvent(event.id, false))}
          >
            Cancel this occurrence
          </button>
          {event.seriesId ? (
            <button
              type="button"
              disabled={busy || event.status === "cancelled"}
              className="h-12 rounded-full text-label-sm tracking-wide text-error disabled:opacity-50"
              onClick={() => void run(() => cancelSchoolEvent(event.id, true))}
            >
              Cancel rest of series
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-body-md text-error">{error}</p> : null}

      {grouped && mine ? (
        <div className="mt-6 flex flex-col gap-3">
          <AttendeeGroup title="Going" rows={grouped.going} students={students} />
          <AttendeeGroup
            title="No response"
            rows={grouped.pending}
            students={students}
          />
          <AttendeeGroup
            title="Waitlist"
            rows={grouped.waitlisted}
            students={students}
          />
          <AttendeeGroup
            title="Declined"
            rows={grouped.declined}
            students={students}
          />
        </div>
      ) : null}
    </DetailSheet>
  );
}

function AttendeeGroup({
  title,
  rows,
  students,
}: {
  title: string;
  rows: EventResponseRow[];
  students: Student[];
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-label-sm tracking-[0.12em] text-on-surface-variant uppercase">
        <Users size={12} strokeWidth={1.75} aria-hidden />
        {title}
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-medium tracking-normal text-on-surface-variant normal-case tabular-nums">
          {rows.length}
        </span>
      </h3>
      <ul className="mt-2 divide-y divide-outline-variant/60">
        {rows.map((row) => {
          const person = findById(students, row.studentId);
          const name = person?.name ?? row.studentId;
          return (
            <li key={row.studentId} className="flex items-center gap-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-[11px] font-semibold tracking-wide text-on-surface-variant">
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-body-md">{name}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
