import {
  Bus,
  Car,
  CarFront,
  CarTaxiFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Footprints,
  Train,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CompanionPicker } from "./CompanionPicker";
import { useAuth } from "../lib/auth";
import { useNow } from "../lib/now";
import {
  createReachRequest,
  crNowStamp,
  leaveTypeMeta,
  localToIso,
  REACH_LEAVE_TYPES,
  REACH_TRANSPORTS,
  suggestedEnd,
  validateReachFile,
  type ReachLeaveType,
  type ReachTransportMode,
} from "../lib/reach";
import type { Student } from "../types";

const TRANSPORT_ICONS: Record<ReachTransportMode, ReactNode> = {
  walking: <Footprints size={16} strokeWidth={1.75} aria-hidden />,
  car: <Car size={16} strokeWidth={1.75} aria-hidden />,
  school_transport: <Bus size={16} strokeWidth={1.75} aria-hidden />,
  taxi: <CarTaxiFront size={16} strokeWidth={1.75} aria-hidden />,
  train: <Train size={16} strokeWidth={1.75} aria-hidden />,
  uber: <CarFront size={16} strokeWidth={1.75} aria-hidden />,
};

export function ReachForm({
  students,
  onDone,
  onCancel,
}: {
  students: Student[];
  onDone: (warning?: string | null) => void;
  onCancel: () => void;
}) {
  const auth = useAuth();
  const now = useNow();
  const live = crNowStamp(now);
  const [leaveType, setLeaveType] = useState<ReachLeaveType>("day");
  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);
  const [startDate, setStartDate] = useState(live.date);
  const [startTime, setStartTime] = useState(live.time);
  const [endDate, setEndDate] = useState(() => suggestedEnd("day", live.date, live.time).date);
  const [endTime, setEndTime] = useState(() => suggestedEnd("day", live.date, live.time).time);
  const [transports, setTransports] = useState<ReachTransportMode[]>(["walking"]);
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [hostOpen, setHostOpen] = useState(false);
  const [hostName, setHostName] = useState("");
  const [hostPhone, setHostPhone] = useState("");
  const [hostAddress, setHostAddress] = useState("");
  const [companionIds, setCompanionIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = leaveTypeMeta(leaveType);
  const shownStart = startTouched ? { date: startDate, time: startTime } : live;
  const shownEnd = endTouched
    ? { date: endDate, time: endTime }
    : suggestedEnd(leaveType, shownStart.date, shownStart.time);
  const hostVisible = meta.emphasizeHost || hostOpen;

  const fileError = useMemo(() => {
    for (const file of files) {
      const invalid = validateReachFile(file);
      if (invalid) return invalid;
    }
    return null;
  }, [files]);

  function chooseType(next: ReachLeaveType) {
    setLeaveType(next);
    setEndTouched(false);
    if (leaveTypeMeta(next).emphasizeHost) setHostOpen(true);
  }

  function toggleTransport(mode: ReachTransportMode) {
    setTransports((current) =>
      current.includes(mode)
        ? current.filter((item) => item !== mode)
        : [...current, mode],
    );
  }

  function moveTransport(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= transports.length) return;
    setTransports((current) => {
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (auth.role !== "student") {
      setError("Only students can request leave.");
      return;
    }
    const dest = destination.trim();
    if (!dest) {
      setError("Say where you are going.");
      return;
    }
    if (transports.length === 0) {
      setError("Pick how you are getting there.");
      return;
    }
    if (leaveType === "overnight" && files.length === 0) {
      setError("Overnight leave needs at least one document.");
      return;
    }
    if (fileError) {
      setError(fileError);
      return;
    }
    const startIso = startTouched
      ? localToIso(shownStart.date, shownStart.time)
      : null;
    const endIso = localToIso(shownEnd.date, shownEnd.time);
    const startMs = startIso ? Date.parse(startIso) : now.getTime();
    if (startMs < now.getTime() - 90_000) {
      setError("Start time has to be now or later.");
      return;
    }
    if (Date.parse(endIso) <= startMs) {
      setError("End time has to be after the start.");
      return;
    }
    setBusy(true);
    const result = await createReachRequest({
      leaveType,
      startsAt: startIso,
      endsAt: endIso,
      destination: dest,
      notes: notes.trim(),
      hostName: hostName.trim(),
      hostPhone: hostPhone.trim(),
      hostAddress: hostAddress.trim(),
      transports,
      companionStudentIds: companionIds,
      files,
    });
    setBusy(false);
    if (result.error || !result.requestId) {
      setError(result.error ?? "Could not create that leave request.");
      return;
    }
    onDone(
      result.uploadError
        ? "Leave saved, but the documents did not upload. Add them from your request."
        : null,
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)}>
      <fieldset>
        <legend className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          Kind of leave
        </legend>
        <div className="mt-2 grid gap-2">
          {REACH_LEAVE_TYPES.map((type) => {
            const selected = type.id === leaveType;
            return (
              <button
                key={type.id}
                type="button"
                aria-pressed={selected}
                className={`rounded-2xl px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                  selected
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface"
                }`}
                onClick={() => chooseType(type.id)}
              >
                <span className="block text-body-md font-medium">{type.label}</span>
                <span
                  className={`mt-0.5 block text-label-sm tracking-wide ${
                    selected ? "text-on-primary/80" : "text-on-surface-variant"
                  }`}
                >
                  {type.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          Start date
          <input
            type="date"
            value={shownStart.date}
            min={live.date}
            onChange={(event) => {
              setStartTouched(true);
              setStartDate(event.target.value);
            }}
            className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none"
          />
        </label>
        <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          Start time
          <input
            type="time"
            value={shownStart.time}
            onChange={(event) => {
              setStartTouched(true);
              setStartTime(event.target.value);
            }}
            className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none"
          />
        </label>
        <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          End date
          <input
            type="date"
            value={shownEnd.date}
            min={shownStart.date}
            onChange={(event) => {
              setEndTouched(true);
              setEndDate(event.target.value);
            }}
            className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none"
          />
        </label>
        <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          End time
          <input
            type="time"
            value={shownEnd.time}
            onChange={(event) => {
              setEndTouched(true);
              setEndTime(event.target.value);
            }}
            className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none"
          />
        </label>
      </div>
      {!startTouched ? (
        <p className="text-body-md text-on-surface-variant">
          Start stays at now until you change it.
        </p>
      ) : null}

      <fieldset>
        <legend className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          Transport
        </legend>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Tap in the order you will use them. Most people only need one.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REACH_TRANSPORTS.map((item) => {
            const selected = transports.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-label-sm tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                  selected
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface"
                }`}
                onClick={() => toggleTransport(item.id)}
              >
                {TRANSPORT_ICONS[item.id]}
                {item.label}
              </button>
            );
          })}
        </div>
        {transports.length > 1 ? (
          <ol className="mt-3 space-y-2">
            {transports.map((mode, index) => (
              <li
                key={`${mode}-${index}`}
                className="flex items-center gap-2 rounded-2xl bg-surface-container-low px-3 py-2"
              >
                <span className="text-label-sm text-on-surface-variant">
                  {index + 1}
                </span>
                <span className="flex-1 text-body-md">
                  {REACH_TRANSPORTS.find((item) => item.id === mode)?.label}
                </span>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full text-on-surface-variant"
                  aria-label="Move earlier"
                  disabled={index === 0}
                  onClick={() => moveTransport(index, -1)}
                >
                  <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full text-on-surface-variant"
                  aria-label="Move later"
                  disabled={index === transports.length - 1}
                  onClick={() => moveTransport(index, 1)}
                >
                  <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </fieldset>

      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Destination
        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="Santa Ana, town, clinic…"
          className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>

      <div>
        <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          People going
        </p>
        <p className="mt-1 mb-2 text-body-md text-on-surface-variant">
          They get invited to this same leave. They just have to accept.
        </p>
        <CompanionPicker
          students={students}
          selectedIds={companionIds}
          excludeId={auth.studentId}
          onChange={setCompanionIds}
        />
      </div>

      <div>
        {meta.emphasizeHost ? (
          <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
            Host
          </p>
        ) : (
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            aria-expanded={hostVisible}
            onClick={() => setHostOpen((open) => !open)}
          >
            <span className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Host · optional
            </span>
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              className={`text-on-surface-variant transition-transform ${
                hostVisible ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        )}
        {hostVisible ? (
          <div className="mt-2 grid gap-3">
            <input
              value={hostName}
              onChange={(event) => setHostName(event.target.value)}
              placeholder="Host name"
              className="h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <input
              value={hostPhone}
              onChange={(event) => setHostPhone(event.target.value)}
              placeholder="Phone"
              className="h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <input
              value={hostAddress}
              onChange={(event) => setHostAddress(event.target.value)}
              placeholder="Address"
              className="h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        ) : null}
      </div>

      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        {leaveType === "overnight" ? "Notes" : "Notes · optional"}
        <textarea
          value={notes}
          rows={leaveType === "overnight" ? 4 : 3}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={
            leaveType === "overnight"
              ? "Who you are staying with, why, anything RC should know"
              : "Anything else RC should know"
          }
          className="mt-2 w-full rounded-2xl bg-surface-container px-4 py-3 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>

      <div>
        <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
          {leaveType === "overnight" ? "Documents" : "Documents · optional"}
        </p>
        <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-container px-4 py-3 text-body-md">
          <FileUp size={16} strokeWidth={1.75} aria-hidden />
          <span className="flex-1">
            {leaveType === "overnight"
              ? "PDF or photo of the overnight papers"
              : "PDF or photo"}
          </span>
          <input
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,.pdf,.png,.jpg,.jpeg,.webp,.heic"
            className="sr-only"
            onChange={(event) => {
              const next = [...files, ...Array.from(event.target.files ?? [])];
              setFiles(next);
              event.target.value = "";
            }}
          />
        </label>
        {files.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-2 rounded-2xl bg-surface-container-low px-3 py-2 text-body-md"
              >
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full text-on-surface-variant"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setFiles((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <X size={14} strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? <p className="text-body-md text-error">{error}</p> : null}

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={busy}
          className="h-12 flex-1 rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-60"
        >
          {busy
            ? "Sending…"
            : meta.needsApproval
              ? "Send for RC"
              : "Request leave"}
        </button>
        <button
          type="button"
          className="h-12 rounded-full bg-surface-container px-5 text-label-sm tracking-wide text-on-surface"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
