import {
  Bell,
  Mail,
  MapPin,
  Megaphone,
  Users,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { EventMode, Student } from "../types";
import { useAuth } from "../lib/auth";
import { toISODate } from "../lib/calendar";
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
import { AudiencePicker } from "./AudiencePicker";

const MODES: {
  id: EventMode;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    id: "mandatory",
    label: "Mandatory",
    hint: "Assigned. No opt-out.",
    icon: <Bell size={16} strokeWidth={1.75} aria-hidden />,
  },
  {
    id: "invite",
    label: "Invite",
    hint: "Accept or decline.",
    icon: <Mail size={16} strokeWidth={1.75} aria-hidden />,
  },
  {
    id: "open",
    label: "Open signup",
    hint: "Join if eligible.",
    icon: <Users size={16} strokeWidth={1.75} aria-hidden />,
  },
  {
    id: "info",
    label: "Announcement",
    hint: "Calendar only.",
    icon: <Megaphone size={16} strokeWidth={1.75} aria-hidden />,
  },
];

const fieldClass =
  "h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

function todayStamp() {
  return toISODate(new Date());
}

function SwitchThumb({ on }: { on: boolean }) {
  return (
    <span
      className={`relative h-[22px] w-[36px] shrink-0 rounded-full transition-colors duration-200 ${
        on ? "bg-primary" : "bg-outline-variant"
      }`}
      aria-hidden
    >
      <span
        className={`absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          on ? "translate-x-[14px]" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function WhenRow({
  label,
  date,
  time,
  minDate,
  allDay,
  onDateChange,
  onTimeChange,
}: {
  label: string;
  date: string;
  time: string;
  minDate?: string;
  allDay: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <div className="event-when-row">
      <p className="event-when-label">{label}</p>
      <div className={`event-when-pair${allDay ? " is-all-day" : ""}`}>
        <label className="event-when-field">
          <span className="sr-only">{label} date</span>
          <input
            type="date"
            value={date}
            min={minDate}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>
        {allDay ? null : (
          <>
            <span className="event-when-split" aria-hidden />
            <label className="event-when-field">
              <span className="sr-only">{label} time</span>
              <input
                type="time"
                value={time}
                onChange={(event) => onTimeChange(event.target.value)}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
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
  const occurrenceCount = useMemo(() => {
    if (editing || freq === "none") return 0;
    return occurrenceStamps(
      date,
      startTime,
      endTime,
      allDay,
      freq,
      untilDate,
      endDate,
    ).starts.length;
  }, [allDay, date, editing, endDate, endTime, freq, startTime, untilDate]);

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

  function setStartDate(next: string) {
    const nextEnd = endDate < next || endDate === date ? next : endDate;
    setDate(next);
    setEndDate(nextEnd);
    if (nextEnd > next && freq === "daily") setFreq("none");
  }

  return (
    <form
      className="event-form flex flex-col gap-8"
      onSubmit={(event) => void onSubmit(event)}
    >
      <section className="event-form-section">
        <p className="event-form-kicker">The gathering</p>
        <label className="block">
          <span className="sr-only">Title</span>
          <input
            required
            value={title}
            placeholder="What’s happening?"
            onChange={(event) => setTitle(event.target.value)}
            className={`${fieldClass} h-14 text-title-md tracking-tight`}
          />
        </label>
        <label className="relative block">
          <span className="sr-only">Where</span>
          <MapPin
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant"
            aria-hidden
          />
          <input
            value={location}
            placeholder="Room, house, lawn…"
            onChange={(event) => setLocation(event.target.value)}
            className={`${fieldClass} pl-11`}
          />
        </label>
        <label className="block">
          <span className="sr-only">Details</span>
          <textarea
            value={description}
            rows={3}
            placeholder="Anything people should know"
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-2xl bg-surface-container px-4 py-3 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </label>
      </section>

      <section className="event-form-section">
        <div className="flex items-center justify-between gap-3">
          <p className="event-form-kicker">When</p>
          <button
            type="button"
            role="switch"
            aria-checked={allDay}
            className="flex shrink-0 items-center gap-2 rounded-full py-1 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            onClick={() => setAllDay((open) => !open)}
          >
            All day
            <SwitchThumb on={allDay} />
          </button>
        </div>

        <div className="event-when">
          <WhenRow
            label="Starts"
            date={date}
            time={startTime}
            allDay={allDay}
            onDateChange={setStartDate}
            onTimeChange={setStartTime}
          />
          <WhenRow
            label="Ends"
            date={endDate}
            time={endTime}
            minDate={date}
            allDay={allDay}
            onDateChange={(next) => {
              setEndDate(next);
              if (next > date && freq === "daily") setFreq("none");
            }}
            onTimeChange={setEndTime}
          />
          {editing ? null : (
            <>
              <div className="event-when-row">
                <p className="event-when-label">Repeat</p>
                <div className="flex flex-wrap gap-2">
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
              </div>
              {freq !== "none" ? (
                <div className="event-when-row">
                  <p className="event-when-label">Until</p>
                  <div className="event-when-pair is-all-day">
                    <label className="event-when-field">
                      <span className="sr-only">Repeats until</span>
                      <input
                        type="date"
                        value={untilDate}
                        min={date}
                        onChange={(event) => setUntilDate(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
        {occurrenceCount > 1 ? (
          <p className="text-label-sm text-on-surface-variant">
            Posts {occurrenceCount} events.
          </p>
        ) : null}
      </section>

      {editing ? null : (
        <>
          <section className="event-form-section">
            <p className="event-form-kicker">How people take part</p>
            <div className="event-mode-grid">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={mode === item.id}
                  className="event-mode"
                  onClick={() => setMode(item.id)}
                >
                  <span className="event-mode-icon">{item.icon}</span>
                  <span className="event-mode-label">{item.label}</span>
                  <span className="event-mode-hint">{item.hint}</span>
                </button>
              ))}
            </div>
            {mode === "open" ? (
              <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                Capacity (optional)
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={capacity}
                  placeholder="No limit"
                  onChange={(event) => setCapacity(event.target.value)}
                  className={`${fieldClass} mt-2 sm:max-w-xs`}
                />
              </label>
            ) : null}
          </section>

          <section className="event-form-section">
            <div className="flex items-baseline justify-between gap-3">
              <p className="event-form-kicker">Who it’s for</p>
              <p className="text-label-sm text-on-surface-variant">
                {audienceCount === 1 ? "1 student" : `${audienceCount} students`}
              </p>
            </div>
            <AudiencePicker
              students={students}
              targets={targets}
              onChange={setTargets}
            />
          </section>
        </>
      )}

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
