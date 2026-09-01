import { useMemo, useState, type FormEvent } from "react";
import type { EventMode, Student } from "../types";
import { useAuth } from "../lib/auth";
import {
  createSchoolEvent,
  crDate,
  crTime,
  expandAudience,
  localToIso,
  notifyEventModeration,
  occurrenceStamps,
  type EventTarget,
  type SchoolEvent,
  updateSchoolEvent,
} from "../lib/schoolEvents";
import { datesBetween, toISODate } from "../lib/calendar";
import { AudiencePicker } from "./AudiencePicker";

const MODES: { id: EventMode; label: string; hint: string }[] = [
  { id: "mandatory", label: "Mandatory", hint: "Assigned. They cannot decline." },
  { id: "invite", label: "Invite", hint: "They accept or decline." },
  { id: "open", label: "Open signup", hint: "Eligible people join. Optional cap." },
  { id: "info", label: "Announcement", hint: "On the calendar. No RSVP." },
];

function todayStamp() {
  return toISODate(new Date());
}

export function EventForm({
  students,
  editing,
  onDone,
  onCancel,
}: {
  students: Student[];
  editing?: SchoolEvent | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const auth = useAuth();
  const needsApproval = auth.role === "student";
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [date, setDate] = useState(() =>
    editing ? crDate(editing.startsAt) : todayStamp(),
  );
  const [endDate, setEndDate] = useState(() =>
    editing ? crDate(editing.endsAt) : todayStamp(),
  );
  const [startTime, setStartTime] = useState(
    editing && !editing.allDay ? crTime(editing.startsAt) : "18:30",
  );
  const [endTime, setEndTime] = useState(
    editing && !editing.allDay ? crTime(editing.endsAt) : "19:30",
  );
  const [allDay, setAllDay] = useState(editing?.allDay ?? false);
  const [mode, setMode] = useState<EventMode>(editing?.mode ?? "invite");
  const [capacity, setCapacity] = useState(
    editing?.capacity != null ? String(editing.capacity) : "",
  );
  const [freq, setFreq] = useState<"none" | "daily" | "weekly">("none");
  const [untilDate, setUntilDate] = useState(todayStamp());
  const [targets, setTargets] = useState<EventTarget[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyToken, setNotifyToken] = useState<string | null>(null);

  const audienceCount = useMemo(
    () => expandAudience(students, targets).length,
    [students, targets],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the event a title.");
      return;
    }
    if (endDate < date) {
      setError("The last day needs to be on or after the first.");
      return;
    }
    if (!allDay && endDate === date && endTime <= startTime) {
      setError("End time needs to be after the start.");
      return;
    }
    setBusy(true);
    if (editing) {
      const message = await updateSchoolEvent(editing.id, {
        title: trimmed,
        description: description.trim(),
        location: location.trim(),
        startsAt: localToIso(date, allDay ? "00:00" : startTime),
        endsAt: localToIso(endDate, allDay ? "23:59" : endTime),
        allDay,
      });
      setBusy(false);
      if (message) setError(message);
      else onDone();
      return;
    }
    if (audienceCount === 0) {
      setBusy(false);
      setError("Pick who this is for.");
      return;
    }
    const stamps = occurrenceStamps(
      date,
      startTime,
      endTime,
      allDay,
      freq,
      untilDate,
      endDate,
    );
    if (stamps.starts.length === 0) {
      setBusy(false);
      setError("No dates in that range.");
      return;
    }
    const cap =
      mode === "open" && capacity.trim()
        ? Number.parseInt(capacity, 10)
        : null;
    const message = await createSchoolEvent({
      title: trimmed,
      description: description.trim(),
      location: location.trim(),
      starts: stamps.starts,
      ends: stamps.ends,
      allDay,
      mode,
      capacity: cap && cap > 0 ? cap : null,
      targets,
      audience: expandAudience(students, targets),
      freq: freq === "none" ? null : freq,
      untilDate: freq === "none" ? null : untilDate,
    });
    if (message.error) {
      setBusy(false);
      setError(message.error);
      return;
    }
    if (needsApproval && message.moderationToken) {
      const notifyError = await notifyEventModeration(
        message.moderationToken,
        window.location.origin,
      );
      setBusy(false);
      if (notifyError) {
        setNotifyToken(message.moderationToken);
        setError(
          `Saved, but we could not email admins: ${notifyError}`,
        );
        return;
      }
      onDone();
      return;
    }
    setBusy(false);
    onDone();
  }

  async function retryNotify() {
    if (!notifyToken) return;
    setBusy(true);
    setError(null);
    const notifyError = await notifyEventModeration(
      notifyToken,
      window.location.origin,
    );
    setBusy(false);
    if (notifyError) setError(notifyError);
    else onDone();
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)}>
      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Title
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>
      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Where
        <input
          value={location}
          placeholder="Room, house, lawn…"
          onChange={(event) => setLocation(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>
      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Details
        <textarea
          value={description}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-2 w-full rounded-2xl bg-surface-container px-4 py-3 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>

      <label className="flex items-center gap-3 text-body-md">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
        />
        All day
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          From
          <input
            type="date"
            value={date}
            onChange={(event) => {
              const next = event.target.value;
              const nextEnd = endDate < next || endDate === date ? next : endDate;
              setDate(next);
              setEndDate(nextEnd);
              if (nextEnd > next && freq === "daily") setFreq("none");
            }}
            className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none"
          />
        </label>
        <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          Until
          <input
            type="date"
            value={endDate}
            min={date}
            onChange={(event) => {
              const next = event.target.value;
              setEndDate(next);
              if (next > date && freq === "daily") setFreq("none");
            }}
            className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none"
          />
        </label>
      </div>
      {allDay ? null : (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
            Starts
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none"
            />
          </label>
          <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
            Ends
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none"
            />
          </label>
        </div>
      )}
      {endDate > date ? (
        <p className="text-body-md text-on-surface-variant">
          Stretches {datesBetween(date, endDate).length} days.
        </p>
      ) : null}

      {editing ? null : (
        <>
          <div>
            <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Repeat
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                endDate > date
                  ? (["none", "weekly"] as const)
                  : (["none", "weekly", "daily"] as const)
              ).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`h-9 rounded-full px-3 text-label-sm tracking-wide ${
                    freq === id
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface"
                  }`}
                  onClick={() => setFreq(id)}
                >
                  {id === "none" ? "Once" : id === "weekly" ? "Weekly" : "Daily"}
                </button>
              ))}
            </div>
            {freq !== "none" ? (
              <label className="mt-3 block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                Until
                <input
                  type="date"
                  value={untilDate}
                  onChange={(event) => setUntilDate(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none sm:max-w-xs"
                />
              </label>
            ) : null}
          </div>

          <div>
            <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              How people take part
            </p>
            <div className="mt-2 grid gap-2">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-2xl px-4 py-3 text-left ${
                    mode === item.id
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface"
                  }`}
                  onClick={() => setMode(item.id)}
                >
                  <span className="block text-label-sm tracking-wide">{item.label}</span>
                  <span
                    className={`block text-label-sm ${
                      mode === item.id ? "text-on-primary/80" : "text-on-surface-variant"
                    }`}
                  >
                    {item.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {mode === "open" ? (
            <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Capacity (optional)
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none sm:max-w-xs"
              />
            </label>
          ) : null}

          <div>
            <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Who
            </p>
            <div className="mt-3">
              <AudiencePicker
                students={students}
                targets={targets}
                onChange={setTargets}
              />
            </div>
          </div>
        </>
      )}

      {needsApproval && !editing ? (
        <p className="text-body-md text-on-surface-variant">
          An admin will get an email to allow this before anyone else can see it.
        </p>
      ) : null}

      {error ? <p className="text-body-md text-error">{error}</p> : null}
      {notifyToken ? (
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-surface-container px-4 text-label-sm tracking-wide disabled:opacity-50"
          onClick={() => void retryNotify()}
        >
          {busy ? "Sending…" : "Email admins again"}
        </button>
      ) : null}

      <div className="flex items-stretch gap-2 pb-8">
        <button
          type="button"
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-surface-container px-5 text-label-sm tracking-wide"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || Boolean(notifyToken)}
          className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-primary px-3 py-2 text-center text-label-sm tracking-wide text-on-primary disabled:opacity-50 sm:px-5"
        >
          {busy
            ? "Saving…"
            : editing
              ? "Save changes"
              : needsApproval
                ? "Submit for approval"
                : "Post event"}
        </button>
      </div>
    </form>
  );
}
