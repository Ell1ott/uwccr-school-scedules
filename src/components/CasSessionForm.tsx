import { useState, type FormEvent } from "react";
import {
  CAS_MODES,
  casOccurrenceStamps,
  createCasSessions,
  crDate,
  crTime,
  defaultCasUntilDate,
  localToIso,
  todayStamp,
  updateCasSession,
  type CasGroup,
  type CasSession,
  type CasSessionMode,
} from "../lib/cas";

export function CasSessionForm({
  group,
  editing,
  onDone,
  onCancel,
}: {
  group: CasGroup;
  editing?: CasSession | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(editing?.label ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [location, setLocation] = useState(
    editing?.location ?? group.location ?? "",
  );
  const [date, setDate] = useState(() =>
    editing ? crDate(editing.startsAt) : todayStamp(),
  );
  const [startTime, setStartTime] = useState(
    editing ? crTime(editing.startsAt) : "12:00",
  );
  const [endTime, setEndTime] = useState(
    editing ? crTime(editing.endsAt) : "13:00",
  );
  const [freq, setFreq] = useState<"none" | "weekly">("none");
  const [untilDate, setUntilDate] = useState(defaultCasUntilDate());
  const [mode, setMode] = useState<CasSessionMode>(editing?.mode ?? "mandatory");
  const [capacity, setCapacity] = useState(
    editing?.capacity != null ? String(editing.capacity) : "",
  );
  const [restOfSeries, setRestOfSeries] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (endTime <= startTime) {
      setError("End time needs to be after the start.");
      return;
    }
    const cap =
      mode === "signup" && capacity.trim()
        ? Number.parseInt(capacity, 10)
        : null;
    setBusy(true);
    if (editing) {
      const message = await updateCasSession(editing.id, {
        label: label.trim(),
        description: description.trim(),
        location: location.trim(),
        startsAt: localToIso(date, startTime),
        endsAt: localToIso(date, endTime),
        mode,
        capacity: cap && cap > 0 ? cap : null,
        restOfSeries: restOfSeries && Boolean(editing.seriesId),
      });
      setBusy(false);
      if (message) setError(message);
      else onDone();
      return;
    }
    const stamps = casOccurrenceStamps(date, startTime, endTime, freq, untilDate);
    if (stamps.starts.length === 0) {
      setBusy(false);
      setError("No dates in that range.");
      return;
    }
    const message = await createCasSessions({
      casId: group.id,
      label: label.trim(),
      description: description.trim(),
      location: location.trim(),
      starts: stamps.starts,
      ends: stamps.ends,
      mode,
      capacity: cap && cap > 0 ? cap : null,
      freq: freq === "weekly" ? "weekly" : null,
      untilDate: freq === "weekly" ? untilDate : null,
    });
    setBusy(false);
    if (message) setError(message);
    else onDone();
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)}>
      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Label (optional)
        <input
          value={label}
          placeholder="Early, late, weekend trip…"
          onChange={(event) => setLabel(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>
      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Where
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>
      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Notes
        <textarea
          value={description}
          rows={2}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-2 w-full rounded-2xl bg-surface-container px-4 py-3 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none"
          />
        </label>
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

      {editing ? (
        editing.seriesId ? (
          <label className="flex items-center gap-3 text-body-md">
            <input
              type="checkbox"
              checked={restOfSeries}
              onChange={(event) => setRestOfSeries(event.target.checked)}
            />
            Also change this and future weeks
          </label>
        ) : null
      ) : (
        <div>
          <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
            Repeat
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["none", "weekly"] as const).map((id) => (
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
                {id === "none" ? "Once" : "Weekly"}
              </button>
            ))}
          </div>
          {freq === "weekly" ? (
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
      )}

      <div>
        <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          How people take part
        </p>
        <div className="mt-2 grid gap-2">
          {CAS_MODES.map((item) => (
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

      {mode === "signup" ? (
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

      {error ? <p className="text-body-md text-error">{error}</p> : null}

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
          disabled={busy}
          className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-primary px-3 py-2 text-center text-label-sm tracking-wide text-on-primary disabled:opacity-50 sm:px-5"
        >
          {busy ? "Saving…" : editing ? "Save session" : "Add session"}
        </button>
      </div>
    </form>
  );
}
