import {
  Bus,
  Car,
  CarFront,
  CarTaxiFront,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileUp,
  Footprints,
  Train,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
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
  updateReachRequest,
  validateReachFile,
  type ReachLeaveType,
  type ReachRequest,
  type ReachTransportMode,
} from "../lib/reach";
import { crDate, crTime, SCHOOL_TZ } from "../lib/schoolEvents";
import type { Student } from "../types";

export type ReachFormStep = "kind" | "details";

const ICONS: Record<ReachTransportMode, ReactNode> = {
  walking: <Footprints size={15} strokeWidth={1.75} aria-hidden />,
  car: <Car size={15} strokeWidth={1.75} aria-hidden />,
  school_transport: <Bus size={15} strokeWidth={1.75} aria-hidden />,
  taxi: <CarTaxiFront size={15} strokeWidth={1.75} aria-hidden />,
  train: <Train size={15} strokeWidth={1.75} aria-hidden />,
  uber: <CarFront size={15} strokeWidth={1.75} aria-hidden />,
};

function stampClass(stamp: "Auto" | "RC" | "Docs") {
  return stamp === "Auto" ? "auto" : stamp === "Docs" ? "docs" : "rc";
}

function formatTime(date: string, time: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(localToIso(date, time)));
}

function formatDay(date: string, time: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(localToIso(date, time)));
}

export function ReachForm({
  students,
  leaveType,
  step,
  direction,
  editing,
  onLeaveTypeChange,
  onStepChange,
  onDone,
}: {
  students: Student[];
  leaveType: ReachLeaveType;
  step: ReachFormStep;
  direction: "forward" | "back";
  editing?: ReachRequest | null;
  onLeaveTypeChange: (type: ReachLeaveType) => void;
  onStepChange: (step: ReachFormStep, direction: "forward" | "back") => void;
  onDone: (warning?: string | null) => void;
}) {
  const auth = useAuth();
  const now = useNow();
  const live = crNowStamp(now);
  const destRef = useRef<HTMLInputElement>(null);
  const [startTouched, setStartTouched] = useState(Boolean(editing));
  const [endTouched, setEndTouched] = useState(Boolean(editing));
  const [startDate, setStartDate] = useState(
    () => (editing ? crDate(editing.startsAt) : live.date),
  );
  const [startTime, setStartTime] = useState(
    () => (editing ? crTime(editing.startsAt) : live.time),
  );
  const [endDate, setEndDate] = useState(
    () =>
      editing
        ? crDate(editing.endsAt)
        : suggestedEnd("day", live.date).date,
  );
  const [endTime, setEndTime] = useState(
    () =>
      editing
        ? crTime(editing.endsAt)
        : suggestedEnd("day", live.date).time,
  );
  const [editingWhen, setEditingWhen] = useState<null | "start" | "end">(null);
  const [transports, setTransports] = useState<ReachTransportMode[]>(
    () => (editing?.transports.length ? editing.transports : ["walking"]),
  );
  const [destination, setDestination] = useState(editing?.destination ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [notesOpen, setNotesOpen] = useState(
    () => Boolean(editing?.notes.trim()),
  );
  const [hostOpen, setHostOpen] = useState(
    () =>
      Boolean(
        editing?.hostName || editing?.hostPhone || editing?.hostAddress,
      ),
  );
  const [hostName, setHostName] = useState(editing?.hostName ?? "");
  const [hostPhone, setHostPhone] = useState(editing?.hostPhone ?? "");
  const [hostAddress, setHostAddress] = useState(editing?.hostAddress ?? "");
  const [companionIds, setCompanionIds] = useState<string[]>(
    () =>
      editing?.companions
        .filter((companion) => companion.status !== "declined")
        .map((companion) => companion.studentId) ?? [],
  );
  const [docsOpen, setDocsOpen] = useState(
    () => Boolean(editing && editing.documents.length > 0),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = leaveTypeMeta(leaveType);
  const start = startTouched ? { date: startDate, time: startTime } : live;
  const end = endTouched
    ? { date: endDate, time: endTime }
    : suggestedEnd(leaveType, start.date);
  const existingDocs = editing?.documents ?? [];
  const showHost = meta.emphasizeHost || hostOpen;
  const showNotes = notesOpen || notes.trim().length > 0;
  const showDocs =
    leaveType === "overnight" ||
    docsOpen ||
    files.length > 0 ||
    existingDocs.length > 0;
  const fileError = useMemo(() => {
    for (const file of files) {
      const invalid = validateReachFile(file);
      if (invalid) return invalid;
    }
    return null;
  }, [files]);

  useEffect(() => {
    if (step === "details") destRef.current?.focus();
  }, [step]);

  function go(next: ReachFormStep, way: "forward" | "back") {
    setError(null);
    setEditingWhen(null);
    onStepChange(next, way);
  }

  function chooseType(next: ReachLeaveType) {
    const nextMeta = leaveTypeMeta(next);
    onLeaveTypeChange(next);
    setEndTouched(false);
    setHostOpen(nextMeta.emphasizeHost);
    setDocsOpen(next === "overnight");
    go("details", "forward");
  }

  function toggleTransport(mode: ReachTransportMode) {
    setTransports((current) =>
      current.includes(mode)
        ? current.filter((item) => item !== mode)
        : [...current, mode],
    );
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
    if (
      leaveType === "overnight" &&
      files.length === 0 &&
      existingDocs.length === 0
    ) {
      setError("Overnight leave needs at least one document.");
      return;
    }
    if (fileError) {
      setError(fileError);
      return;
    }
    const keepingStart =
      editing != null &&
      crDate(editing.startsAt) === start.date &&
      crTime(editing.startsAt) === start.time;
    const startIso =
      editing || startTouched ? localToIso(start.date, start.time) : null;
    const endIso = localToIso(end.date, end.time);
    const startMs = startIso ? Date.parse(startIso) : now.getTime();
    if (!keepingStart && startMs < now.getTime() - 90_000) {
      setError("Start time has to be now or later.");
      return;
    }
    if (Date.parse(endIso) <= startMs) {
      setError("End time has to be after the start.");
      return;
    }
    const payload = {
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
    };
    setBusy(true);
    const result = editing
      ? await updateReachRequest({ requestId: editing.id, ...payload })
      : await createReachRequest(payload);
    setBusy(false);
    if (result.error || !result.requestId) {
      setError(
        result.error ??
          (editing
            ? "Could not save that leave request."
            : "Could not create that leave request."),
      );
      return;
    }
    if (result.uploadError) {
      onDone(
        "Leave saved, but the documents did not upload. Add them from your request.",
      );
      return;
    }
    if (editing && meta.needsApproval) {
      onDone(
        editing.status === "approved"
          ? "Saved. This leave needs approval again."
          : "Saved. Waiting for RC.",
      );
      return;
    }
    onDone(null);
  }

  return (
    <form
      className={step === "details" ? "reach-body docked" : "reach-body"}
      onSubmit={(event) => void onSubmit(event)}
    >
      {step === "kind" ? (
        <div className={`reach-step${direction === "back" ? " back" : ""}`}>
          <h2 className="reach-title">What kind of leave?</h2>
          <p className="reach-lead">Tap one to continue.</p>
          {(["quick", "ask"] as const).map((group) => (
            <section key={group} className="mt-5">
              <p className="reach-label">
                {group === "quick" ? "Single day" : "Multiple days"}
              </p>
              <div className="reach-group">
                {REACH_LEAVE_TYPES.filter((type) => type.group === group).map(
                  (type) => (
                    <button
                      key={type.id}
                      type="button"
                      className="reach-type"
                      onClick={() => chooseType(type.id)}
                    >
                      <span className="min-w-0 flex-1">
                        <b>{type.label}</b>
                        <span>{type.window}</span>
                      </span>
                      <i className={`reach-tag ${stampClass(type.stamp)}`}>
                        {type.stamp}
                      </i>
                      <ChevronRight
                        size={18}
                        strokeWidth={1.75}
                        className="text-[var(--reach-muted)]"
                        aria-hidden
                      />
                    </button>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="reach-step">
          <label className="reach-field reach-group">
            <span>Destination</span>
            <input
              ref={destRef}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Santa Ana, town, clinic…"
              autoComplete="off"
            />
          </label>

          <div className="mt-4">
            <p className="reach-label">When</p>
            <div className="reach-group reach-when">
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingWhen((current) =>
                      current === "start" ? null : "start",
                    )
                  }
                >
                  <span className="reach-label">
                    {startTouched ? (
                      "Start"
                    ) : (
                      <>
                        <i className="reach-live" aria-hidden />
                        Leaving now
                      </>
                    )}
                  </span>
                  <strong>{formatTime(start.date, start.time)}</strong>
                  <span className="reach-meta">
                    {formatDay(start.date, start.time)}
                  </span>
                </button>
                {editingWhen === "start" ? (
                  <div className="reach-time-edit">
                    <input
                      type="date"
                      value={start.date}
                      min={
                        editing && crDate(editing.startsAt) < live.date
                          ? crDate(editing.startsAt)
                          : live.date
                      }
                      onChange={(event) => {
                        setStartTouched(true);
                        setStartDate(event.target.value);
                      }}
                    />
                    <input
                      type="time"
                      value={start.time}
                      onChange={(event) => {
                        setStartTouched(true);
                        setStartTime(event.target.value);
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingWhen((current) =>
                      current === "end" ? null : "end",
                    )
                  }
                >
                  <span className="reach-label">Back by</span>
                  <strong>{formatTime(end.date, end.time)}</strong>
                  <span className="reach-meta">
                    {formatDay(end.date, end.time)}
                  </span>
                </button>
                {editingWhen === "end" ? (
                  <div className="reach-time-edit">
                    <input
                      type="date"
                      value={end.date}
                      min={start.date}
                      onChange={(event) => {
                        setEndTouched(true);
                        setEndDate(event.target.value);
                      }}
                    />
                    <input
                      type="time"
                      value={end.time}
                      onChange={(event) => {
                        setEndTouched(true);
                        setEndTime(event.target.value);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="reach-label">People going</p>
            <div className="reach-group">
              <div className="reach-field">
                <CompanionPicker
                  students={students}
                  selectedIds={companionIds}
                  excludeId={auth.studentId}
                  onChange={setCompanionIds}
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="reach-label">How</p>
            <div className="reach-group">
              <div className="reach-modes">
                {REACH_TRANSPORTS.map((item) => {
                  const on = transports.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={on}
                      className={`reach-mode${on ? " on" : ""}`}
                      onClick={() => toggleTransport(item.id)}
                    >
                      {ICONS[item.id]}
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {transports.length > 1 ? (
                <ol className="reach-stack">
                  {transports.map((mode, index) => (
                    <li key={`${mode}-${index}`}>
                      {index + 1}.{" "}
                      {REACH_TRANSPORTS.find((item) => item.id === mode)?.label}
                      <span className="reach-move">
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() =>
                            setTransports((current) => {
                              const next = [...current];
                              const [item] = next.splice(index, 1);
                              next.splice(index - 1, 0, item);
                              return next;
                            })
                          }
                        >
                          <ChevronUp size={18} strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={index === transports.length - 1}
                          onClick={() =>
                            setTransports((current) => {
                              const next = [...current];
                              const [item] = next.splice(index, 1);
                              next.splice(index + 1, 0, item);
                              return next;
                            })
                          }
                        >
                          <ChevronDown size={18} strokeWidth={1.75} aria-hidden />
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>

          {showHost ? (
            <div className="reach-group mt-4">
              <label className="reach-field">
                <span>Host name</span>
                <input
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="reach-field">
                <span>Phone</span>
                <input
                  value={hostPhone}
                  onChange={(event) => setHostPhone(event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="reach-field">
                <span>Address</span>
                <input
                  value={hostAddress}
                  onChange={(event) => setHostAddress(event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
          ) : null}

          {showNotes ? (
            <label className="reach-field reach-group mt-4">
              <span>Note</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything RC should know"
              />
            </label>
          ) : null}

          {showDocs ? (
            <div className="reach-group mt-4">
              <p className="reach-label mt-3">
                {leaveType === "overnight" ? "Documents · required" : "Documents"}
              </p>
              {existingDocs.length > 0 ? (
                <ul className="reach-files">
                  {existingDocs.map((doc) => (
                    <li key={doc.id}>
                      <span className="min-w-0 flex-1 truncate">
                        {doc.fileName}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <label className="reach-drop">
                <FileUp size={16} strokeWidth={1.75} aria-hidden />
                Add a PDF or photo
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,.pdf,.png,.jpg,.jpeg,.webp,.heic"
                  className="sr-only"
                  onChange={(event) => {
                    setFiles([
                      ...files,
                      ...Array.from(event.target.files ?? []),
                    ]);
                    event.target.value = "";
                  }}
                />
              </label>
              {files.length > 0 ? (
                <ul className="reach-files">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${index}`}>
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <X size={14} strokeWidth={1.75} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="reach-add">
            {showNotes ? null : (
              <button type="button" onClick={() => setNotesOpen(true)}>
                + Note
              </button>
            )}
            {showHost ? null : (
              <button type="button" onClick={() => setHostOpen(true)}>
                + Host
              </button>
            )}
            {showDocs ? null : (
              <button type="button" onClick={() => setDocsOpen(true)}>
                + Papers
              </button>
            )}
          </div>

          {error ? <p className="reach-err">{error}</p> : null}
        </div>
      )}

      {step === "details" ? (
        <div className="reach-dock">
          <button type="submit" disabled={busy}>
            {busy
              ? editing
                ? "Saving…"
                : "Sending…"
              : editing
                ? meta.needsApproval
                  ? "Save for approval"
                  : "Save"
                : meta.needsApproval
                  ? "Send for approval"
                  : "Submit"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
