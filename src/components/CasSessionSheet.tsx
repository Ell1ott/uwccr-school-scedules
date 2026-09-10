import { Calendar, MapPin, Users } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/classDetail";
import {
  cancelCasSession,
  cancelCasSignup,
  casSessionLabel,
  casSessionReplacedBySplit,
  fetchCasSignups,
  formatCasWhen,
  localToIso,
  restoreCasSession,
  signupCasSession,
  splitCasSession,
  type CasGroup,
  type CasSession,
  type CasSignupRow,
} from "../lib/cas";
import { crDate } from "../lib/schoolEvents";
import { LinkifiedText } from "../lib/linkify";
import { usePalette } from "../lib/palette";
import { findById } from "../lib/people";
import { toneForEvent } from "../lib/tones";
import type { Student } from "../types";
import { DetailSheet, SheetFact } from "./BottomSheet";

export function CasSessionSheet({
  group,
  session,
  students,
  onClose,
  onEdit,
}: {
  group: CasGroup;
  session: CasSession;
  students: Student[];
  onClose: () => void;
  onEdit?: () => void;
}) {
  const auth = useAuth();
  const { palette } = usePalette();
  const tone = toneForEvent(
    {
      id: session.id,
      kind: "cas",
      title: session.title,
      start: "",
      end: "",
      startMin: 0,
      endMin: 0,
      emphasis:
        session.mode === "signup" && session.mySignup === "going"
          ? "strong"
          : session.mode === "mandatory"
            ? "normal"
            : "quiet",
    },
    palette,
  );
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signups, setSignups] = useState<CasSignupRow[] | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [splitA, setSplitA] = useState({ start: "09:00", end: "10:00", label: "Early" });
  const [splitB, setSplitB] = useState({ start: "10:00", end: "11:00", label: "Late" });
  const [splitCap, setSplitCap] = useState("");

  useEffect(() => {
    if (!group.iAmLeader || session.mode !== "signup") return;
    let active = true;
    fetchCasSignups(session.id).then((rows) => {
      if (active) setSignups(rows);
    });
    return () => {
      active = false;
    };
  }, [group.iAmLeader, session.id, session.mode, session.goingCount]);

  const grouped = useMemo(() => {
    if (!signups) return null;
    return {
      going: signups.filter((row) => row.status === "going"),
      waitlisted: signups.filter((row) => row.status === "waitlisted"),
    };
  }, [signups]);

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const message = await action();
    setBusy(false);
    if (message) setError(message);
  }

  const studentCanSignup =
    auth.role === "student" &&
    group.iAmMember &&
    session.status === "published" &&
    session.mode === "signup";

  const date = crDate(session.startsAt);

  return (
    <DetailSheet
      labelledBy={titleId}
      overlayLabel="Close session"
      onClose={onClose}
      tone={tone}
      kicker={
        session.status === "cancelled"
          ? `${group.title} · Cancelled`
          : group.title
      }
      title={<span>{session.label || group.title}</span>}
      chip={casSessionLabel(session)}
    >
      <dl className="grid grid-cols-2 gap-3">
        <SheetFact
          label="When"
          value={formatCasWhen(session)}
          icon={<Calendar size={14} strokeWidth={1.75} />}
        />
        <SheetFact
          label="Where"
          value={session.location || group.location || "—"}
          icon={<MapPin size={14} strokeWidth={1.75} />}
        />
      </dl>

      {session.description ? (
        <LinkifiedText
          text={session.description}
          className="mt-6 whitespace-pre-wrap break-words text-body-md"
        />
      ) : null}

      {session.mode === "signup" ? (
        <p className="mt-4 text-label-sm text-on-surface-variant">
          {session.goingCount} signed up
          {session.waitlistedCount > 0
            ? ` · ${session.waitlistedCount} waitlisted`
            : ""}
          {session.capacity != null ? ` · ${session.capacity} spots` : ""}
        </p>
      ) : null}

      {studentCanSignup ? (
        session.mySignup ? (
          <button
            type="button"
            disabled={busy}
            className="mt-6 h-12 w-full rounded-full bg-surface-container text-label-sm tracking-wide disabled:opacity-50"
            onClick={() => void run(() => cancelCasSignup(session.id))}
          >
            Cancel signup
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
            onClick={() =>
              void run(async () => {
                const result = await signupCasSession(session.id);
                return result.error;
              })
            }
          >
            Sign up
          </button>
        )
      ) : null}

      {group.iAmLeader && session.status === "published" ? (
        <div className="mt-6 flex flex-col gap-2">
          {onEdit ? (
            <button
              type="button"
              className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide"
              onClick={onEdit}
            >
              Edit this session
            </button>
          ) : null}
          <button
            type="button"
            className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide"
            onClick={() => setSplitting((open) => !open)}
          >
            Split this week
          </button>
          {splitting ? (
            <div className="rounded-[20px] bg-surface-container px-4 py-4">
              <p className="text-body-md text-on-surface-variant">
                Replaces this session. People pick one of the new times.
              </p>
              {[
                { value: splitA, set: setSplitA, name: "First" },
                { value: splitB, set: setSplitB, name: "Second" },
              ].map((slot) => (
                <div key={slot.name} className="mt-3 grid grid-cols-3 gap-2">
                  <input
                    value={slot.value.label}
                    placeholder={slot.name}
                    onChange={(event) =>
                      slot.set({ ...slot.value, label: event.target.value })
                    }
                    className="h-11 rounded-2xl bg-surface-container-lowest px-3 text-body-md outline-none"
                  />
                  <input
                    type="time"
                    value={slot.value.start}
                    onChange={(event) =>
                      slot.set({ ...slot.value, start: event.target.value })
                    }
                    className="h-11 rounded-2xl bg-surface-container-lowest px-3 text-body-md outline-none"
                  />
                  <input
                    type="time"
                    value={slot.value.end}
                    onChange={(event) =>
                      slot.set({ ...slot.value, end: event.target.value })
                    }
                    className="h-11 rounded-2xl bg-surface-container-lowest px-3 text-body-md outline-none"
                  />
                </div>
              ))}
              <input
                type="number"
                min={1}
                placeholder="Capacity (optional)"
                value={splitCap}
                onChange={(event) => setSplitCap(event.target.value)}
                className="mt-3 h-11 w-full rounded-2xl bg-surface-container-lowest px-3 text-body-md outline-none"
              />
              <button
                type="button"
                disabled={busy}
                className="mt-3 h-11 w-full rounded-full bg-primary text-label-sm text-on-primary disabled:opacity-50"
                onClick={() =>
                  void run(async () => {
                    const message = await splitCasSession({
                      sessionId: session.id,
                      starts: [
                        localToIso(date, splitA.start),
                        localToIso(date, splitB.start),
                      ],
                      ends: [
                        localToIso(date, splitA.end),
                        localToIso(date, splitB.end),
                      ],
                      labels: [splitA.label, splitB.label],
                      capacity: splitCap.trim()
                        ? Number.parseInt(splitCap, 10)
                        : null,
                    });
                    if (!message) onClose();
                    return message;
                  })
                }
              >
                Split into these two
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide disabled:opacity-50"
            onClick={() => void run(() => cancelCasSession(session.id, false))}
          >
            Cancel this session
          </button>
          {session.seriesId ? (
            <button
              type="button"
              disabled={busy}
              className="h-12 rounded-full text-label-sm tracking-wide text-error disabled:opacity-50"
              onClick={() => void run(() => cancelCasSession(session.id, true))}
            >
              Cancel this and future weeks
            </button>
          ) : null}
        </div>
      ) : null}

      {group.iAmLeader &&
      session.status === "cancelled" &&
      !casSessionReplacedBySplit(group, session) ? (
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            className="h-12 rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
            onClick={() => void run(() => restoreCasSession(session.id, false))}
          >
            Restore this session
          </button>
          {session.seriesId ? (
            <button
              type="button"
              disabled={busy}
              className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide disabled:opacity-50"
              onClick={() => void run(() => restoreCasSession(session.id, true))}
            >
              Restore this and future weeks
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-body-md text-error">{error}</p> : null}

      {grouped && group.iAmLeader ? (
        <div className="mt-6 flex flex-col gap-3">
          <SignupGroup title="Signed up" rows={grouped.going} students={students} />
          <SignupGroup
            title="Waitlist"
            rows={grouped.waitlisted}
            students={students}
          />
        </div>
      ) : null}
    </DetailSheet>
  );
}

function SignupGroup({
  title,
  rows,
  students,
}: {
  title: string;
  rows: CasSignupRow[];
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
