import { ArrowLeft, ChevronDown, DoorOpen, FileUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReachForm, type ReachFormStep } from "./ReachForm";
import { StudentQrCard } from "./StudentQrCard";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/classDetail";
import { useNow } from "../lib/now";
import {
  canLeaveReachRequest,
  canManageReachRequest,
  deleteReachRequest,
  formatReachRange,
  leaveReachRequest,
  leaveTypeMeta,
  reachRequestIsOverdue,
  reachRequestIsPast,
  reachRequestLocked,
  respondReachInvite,
  transportLabel,
  uploadReachDocuments,
  useReachCatalog,
  type ReachLeaveType,
  type ReachRequest,
  type ReachRequestStatus,
} from "../lib/reach";
import type { Student } from "../types";

function statusLabel(status: ReachRequestStatus) {
  if (status === "approved") return "Approved";
  if (status === "pending") return "Waiting";
  if (status === "denied") return "Declined";
  if (status === "active") return "Out";
  if (status === "returned") return "Back";
  return "Cancelled";
}

function statusTone(status: ReachRequestStatus) {
  if (status === "approved" || status === "returned") return "ok";
  if (status === "pending" || status === "active") return "wait";
  return "bad";
}

function stampClass(stamp: "Auto" | "RC" | "Docs") {
  return stamp === "Auto" ? "auto" : stamp === "Docs" ? "docs" : "rc";
}

function studentName(students: Student[], id: string) {
  return students.find((student) => student.id === id)?.name ?? "A student";
}

export function ReachPage({
  students,
  draft,
  requestId,
  onBack,
  onOpenLogin,
  onDraftChange,
  embedded = false,
}: {
  students: Student[];
  draft: "new" | "edit" | null;
  requestId?: string;
  onBack: () => void;
  onOpenLogin?: () => void;
  onDraftChange: (draft: "new" | string | null) => void;
  embedded?: boolean;
}) {
  const auth = useAuth();
  const loggedOut = !auth.session || !auth.role;
  const ready = Boolean(auth.session && auth.role);
  const { requests, loaded, refresh } = useReachCatalog(ready);
  const nowMs = Math.floor(useNow().getTime() / 60_000) * 60_000;
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [step, setStep] = useState<ReachFormStep>("kind");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [leaveType, setLeaveType] = useState<ReachLeaveType>("day");
  const primedEdit = useRef<string | null>(null);
  const editing =
    draft === "edit" && requestId
      ? requests.find((request) => request.id === requestId) ?? null
      : null;
  const draftMeta = leaveTypeMeta(leaveType);

  useEffect(() => {
    if (draft !== "edit") {
      primedEdit.current = null;
      return;
    }
    if (!editing || primedEdit.current === editing.id) return;
    primedEdit.current = editing.id;
    setLeaveType(editing.leaveType);
    setDirection("forward");
    setStep("details");
  }, [draft, editing]);

  const mine = requests.filter(
    (request) =>
      request.studentId === auth.studentId ||
      request.createdBy === auth.profileId ||
      request.companions.some(
        (companion) =>
          companion.studentId === auth.studentId &&
          companion.status === "accepted",
      ),
  );
  const invites = requests.filter(
    (request) =>
      !reachRequestIsPast(request, nowMs) &&
      request.companions.some(
        (companion) =>
          companion.studentId === auth.studentId &&
          companion.status === "pending",
      ),
  );
  const list = auth.role === "staff" ? requests : mine;
  const { current, old } = useMemo(() => {
    const current: ReachRequest[] = [];
    const old: ReachRequest[] = [];
    for (const request of list) {
      if (reachRequestIsPast(request, nowMs)) old.push(request);
      else current.push(request);
    }
    return { current, old };
  }, [list, nowMs]);

  async function answerInvite(requestId: string, accept: boolean) {
    setInviteError(null);
    const message = await respondReachInvite(requestId, accept);
    if (message) setInviteError(message);
    await refresh();
  }

  const composing = draft === "new" || draft === "edit";

  function requestCard(request: ReachRequest) {
    return (
      <ReachRequestCard
        key={request.id}
        request={request}
        students={students}
        canAttach={request.createdBy === auth.profileId}
        canManage={canManageReachRequest(request, auth)}
        canLeave={canLeaveReachRequest(request, auth)}
        onAttached={() => void refresh()}
        onEdit={() => {
          setLeaveType(request.leaveType);
          setDirection("forward");
          setStep("details");
          onDraftChange(request.id);
        }}
        onDeleted={(message) => {
          if (message) setNotice(message);
          void refresh();
        }}
        onLeft={(message) => {
          if (message) setNotice(message);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className={embedded ? "reach-app embedded" : "reach-app"}>
      <div className="reach-shell">
        <header className="reach-nav">
          {embedded && !composing ? (
            <button type="button" disabled aria-hidden />
          ) : (
            <button
              type="button"
              aria-label="Back"
              onClick={() => {
                if (composing && step === "details") {
                  setDirection("back");
                  setStep("kind");
                  return;
                }
                if (composing) {
                  onDraftChange(null);
                  setStep("kind");
                  return;
                }
                onBack();
              }}
            >
              <ArrowLeft size={22} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          {composing && step === "details" ? (
            <button
              type="button"
              className="reach-nav-type"
              aria-label={`Change leave type, currently ${draftMeta.label}`}
              onClick={() => {
                setDirection("back");
                setStep("kind");
              }}
            >
              <h1>{draftMeta.label}</h1>
              <i className={`reach-tag ${stampClass(draftMeta.stamp)}`}>
                {draftMeta.stamp}
              </i>
            </button>
          ) : (
            <h1>
              {draft === "edit"
                ? "Edit leave"
                : draft === "new"
                  ? "New leave"
                  : "Reach"}
            </h1>
          )}
          {composing ? (
            <div className="reach-dots" aria-hidden>
              <i className={step === "kind" ? "on" : ""} />
              <i className={step === "details" ? "on" : ""} />
            </div>
          ) : (
            <button type="button" disabled aria-hidden />
          )}
        </header>

        {composing ? (
          auth.role === "student" ? (
            draft === "edit" && !loaded ? (
              <main className="reach-body">
                <p className="reach-lead">Loading…</p>
              </main>
            ) : draft === "edit" && !editing ? (
              <main className="reach-body">
                <p className="reach-lead">That leave is gone.</p>
              </main>
            ) : draft === "edit" &&
              editing &&
              !canManageReachRequest(editing, auth) ? (
              <main className="reach-body">
                <p className="reach-lead">
                  {reachRequestLocked(editing.status)
                    ? "This leave cannot be changed after sign-out."
                    : "Only the student who created this leave can change it."}
                </p>
              </main>
            ) : (
              <ReachForm
                key={editing?.id ?? "new"}
                students={students}
                leaveType={leaveType}
                step={step}
                direction={direction}
                editing={draft === "edit" ? editing : null}
                onLeaveTypeChange={setLeaveType}
                onStepChange={(next, way) => {
                  setDirection(way);
                  setStep(next);
                }}
                onDone={(warning) => {
                  setNotice(warning ?? null);
                  setStep("kind");
                  onDraftChange(null);
                  void refresh();
                }}
              />
            )
          ) : (
            <main className="reach-body">
              <p className="reach-lead">Only students can create leave requests.</p>
            </main>
          )
        ) : (
          <>
            <main
              className={
                auth.role === "student" ? "reach-body docked" : "reach-body"
              }
            >
            {loggedOut ? (
              <div className="reach-login">
                <DoorOpen size={28} strokeWidth={1.5} className="mx-auto text-[var(--reach-muted)]" />
                <h2>Log in to leave campus</h2>
                <p>Same Google account as the schedule. Day leave is auto approved.</p>
                <button type="button" className="reach-cta" onClick={() => onOpenLogin?.()}>
                  Log in
                </button>
              </div>
            ) : (
              <>
                {auth.role === "staff" ? (
                  <p className="reach-note">
                    Staff approvals come later. You can see student requests here.
                  </p>
                ) : null}
                {notice ? <p className="reach-note">{notice}</p> : null}
                {inviteError ? <p className="reach-err">{inviteError}</p> : null}

                {auth.role === "student" && auth.studentId ? (
                  <StudentQrCard
                    studentId={auth.studentId}
                    name={auth.displayName ?? "Student"}
                  />
                ) : null}

                {invites.length > 0 ? (
                  <section>
                    <p className="reach-label">Invites</p>
                    <div className="grid gap-3">
                      {invites.map((request) => {
                        const meta = leaveTypeMeta(request.leaveType);
                        return (
                          <article key={request.id} className="reach-card">
                            <div className="reach-card-top">
                              <i className={`reach-tag ${stampClass(meta.stamp)}`}>
                                {meta.shortLabel}
                              </i>
                            </div>
                            <h3>Join {studentName(students, request.studentId)}</h3>
                            <p>
                              {request.destination}
                              <br />
                              {formatReachRange(request.startsAt, request.endsAt)}
                            </p>
                            <div className="reach-actions">
                              <button
                                type="button"
                                className="yes"
                                onClick={() => void answerInvite(request.id, true)}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="no"
                                onClick={() => void answerInvite(request.id, false)}
                              >
                                Decline
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                <section>
                  <p className="reach-label">
                    {auth.role === "staff" ? "All requests" : "Your leaves"}
                  </p>
                  {!loaded ? (
                    <p className="reach-lead">Loading…</p>
                  ) : current.length === 0 && old.length === 0 ? (
                    <div className="reach-empty">
                      <DoorOpen
                        size={28}
                        strokeWidth={1.5}
                        className="mx-auto text-[var(--reach-muted)]"
                        aria-hidden
                      />
                      <h2>No leave yet</h2>
                      <p>
                        Day leave from 6 AM to 6 PM is auto approved. Evenings and
                        overnights wait for RC.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {current.map(requestCard)}
                      {old.length > 0 ? (
                        <>
                          <button
                            type="button"
                            className="reach-old"
                            aria-expanded={showOld}
                            onClick={() => setShowOld((open) => !open)}
                          >
                            <span>Old</span>
                            <i>
                              {showOld
                                ? "Hide"
                                : old.length === 1
                                  ? "1 leave"
                                  : `${old.length} leaves`}
                              <ChevronDown size={16} strokeWidth={2} aria-hidden />
                            </i>
                          </button>
                          {showOld ? old.map(requestCard) : null}
                        </>
                      ) : null}
                    </div>
                  )}
                </section>
              </>
            )}
            </main>
            {auth.role === "student" ? (
              <div className="reach-dock">
                <button
                  type="button"
                  onClick={() => {
                    setLeaveType("day");
                    setDirection("forward");
                    setStep("kind");
                    onDraftChange("new");
                  }}
                >
                  New leave
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ReachRequestCard({
  request,
  students,
  canAttach,
  canManage,
  canLeave,
  onAttached,
  onEdit,
  onDeleted,
  onLeft,
}: {
  request: ReachRequest;
  students: Student[];
  canAttach: boolean;
  canManage: boolean;
  canLeave: boolean;
  onAttached: () => void;
  onEdit: () => void;
  onDeleted: (message: string | null) => void;
  onLeft: (message: string | null) => void;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const owner = studentName(students, request.studentId);
  const meta = leaveTypeMeta(request.leaveType);
  const needsDocs =
    request.leaveType === "overnight" && request.documents.length === 0;

  async function onFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setActionError(null);
    const result = await uploadReachDocuments(request.id, files);
    if (result.error) setActionError(result.error);
    onAttached();
  }

  async function onDelete() {
    setBusy(true);
    const message = await deleteReachRequest(
      request.id,
      request.documents.map((doc) => doc.path),
    );
    setBusy(false);
    if (message) {
      setActionError(message);
      setConfirmDelete(false);
      return;
    }
    onDeleted(null);
  }

  async function onLeave() {
    setBusy(true);
    const message = await leaveReachRequest(request.id);
    setBusy(false);
    if (message) {
      setActionError(message);
      setConfirmLeave(false);
      return;
    }
    onLeft("You are no longer on that leave.");
  }

  return (
    <article className="reach-card">
      <div className="reach-card-top">
        <i className={`reach-tag ${stampClass(meta.stamp)}`}>{meta.shortLabel}</i>
        <span className={`reach-status ${statusTone(request.status)}`}>
          {statusLabel(request.status)}
        </span>
      </div>
      <h3>{request.destination}</h3>
      <p>
        {formatReachRange(request.startsAt, request.endsAt)}
        <br />
        {request.transports.map(transportLabel).join(" → ")} · {owner}
      </p>
      {reachRequestIsOverdue(request) ? (
        <p className="reach-err">Back time has passed.</p>
      ) : null}
      {request.companions.length > 0 ? (
        <ul className="reach-people">
          {request.companions.map((companion) => (
            <li key={companion.studentId}>
              <span className="reach-avatar" aria-hidden>
                {initials(studentName(students, companion.studentId))}
              </span>
              {studentName(students, companion.studentId).split(" ")[0]}
              <span className="text-[var(--reach-muted)]">
                {companion.status === "accepted"
                  ? "in"
                  : companion.status === "declined"
                    ? "no"
                    : "…"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {request.hostName ? (
        <p>
          Host {request.hostName}
          {request.hostPhone ? ` · ${request.hostPhone}` : ""}
        </p>
      ) : null}
      {request.documents.length > 0 ? (
        <p>
          {request.documents.length} document
          {request.documents.length === 1 ? "" : "s"} attached
        </p>
      ) : null}
      {needsDocs && canAttach ? (
        <label className="reach-drop">
          <FileUp size={16} strokeWidth={1.75} aria-hidden />
          Add the overnight documents
          <input
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,.pdf,.png,.jpg,.jpeg,.webp,.heic"
            className="sr-only"
            onChange={(event) => {
              void onFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      ) : null}
      {canManage ? (
        <div className="reach-actions">
          {confirmDelete ? (
            <>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => void onDelete()}
              >
                {busy ? "Deleting…" : "Delete leave"}
              </button>
              <button
                type="button"
                className="no"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Keep
              </button>
            </>
          ) : (
            <>
              <button type="button" className="yes" onClick={onEdit}>
                Edit
              </button>
              <button
                type="button"
                className="no"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      ) : null}
      {canLeave ? (
        <div className="reach-actions">
          {confirmLeave ? (
            <>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => void onLeave()}
              >
                {busy ? "Leaving…" : "Yes, leave"}
              </button>
              <button
                type="button"
                className="no"
                disabled={busy}
                onClick={() => setConfirmLeave(false)}
              >
                Stay
              </button>
            </>
          ) : (
            <button
              type="button"
              className="no"
              onClick={() => setConfirmLeave(true)}
            >
              Leave
            </button>
          )}
        </div>
      ) : null}
      {actionError ? <p className="reach-err">{actionError}</p> : null}
    </article>
  );
}
