import { ArrowLeft, DoorOpen, FileUp, Plus } from "lucide-react";
import { useState } from "react";
import { ReachForm } from "./ReachForm";
import { StudentQrCard } from "./StudentQrCard";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/classDetail";
import {
  formatReachRange,
  leaveTypeMeta,
  respondReachInvite,
  transportLabel,
  uploadReachDocuments,
  useReachCatalog,
  type ReachRequest,
  type ReachRequestStatus,
} from "../lib/reach";
import type { Student } from "../types";

function statusLabel(status: ReachRequestStatus) {
  if (status === "approved") return "Approved";
  if (status === "pending") return "Waiting for RC";
  if (status === "denied") return "Declined";
  if (status === "active") return "Out";
  if (status === "returned") return "Back";
  return "Cancelled";
}

export function ReachPage({
  students,
  draft,
  onBack,
  onOpenLogin,
  onDraftChange,
}: {
  students: Student[];
  draft: "new" | null;
  onBack: () => void;
  onOpenLogin?: () => void;
  onDraftChange: (draft: "new" | null) => void;
}) {
  const auth = useAuth();
  const loggedOut = !auth.session || !auth.role;
  const ready = Boolean(auth.session && auth.role);
  const { requests, loaded, refresh } = useReachCatalog(ready);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

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
  const invites = requests.filter((request) =>
    request.companions.some(
      (companion) =>
        companion.studentId === auth.studentId && companion.status === "pending",
    ),
  );

  async function answerInvite(requestId: string, accept: boolean) {
    setInviteError(null);
    const message = await respondReachInvite(requestId, accept);
    if (message) setInviteError(message);
    await refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <header className="flex items-center gap-3 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 md:px-container-padding-desktop">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          aria-label="Back to schedules"
          onClick={draft ? () => onDraftChange(null) : onBack}
        >
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            Leave campus
          </p>
          <h1 className="text-title-md tracking-tight">
            {draft === "new" ? "New request" : "Reach"}
          </h1>
        </div>
        {draft || loggedOut || auth.role !== "student" ? null : (
          <button
            type="button"
            className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-3 text-label-sm tracking-wide text-on-primary"
            onClick={() => onDraftChange("new")}
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            New
          </button>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-container-padding-mobile pb-safe md:px-container-padding-desktop">
        {draft === "new" ? (
          auth.role === "student" ? (
            <ReachForm
              students={students}
              onDone={(warning) => {
                setNotice(warning ?? null);
                onDraftChange(null);
                void refresh();
              }}
              onCancel={() => onDraftChange(null)}
            />
          ) : (
            <p className="text-body-md text-on-surface-variant">
              Only students can create leave requests.
            </p>
          )
        ) : loggedOut ? (
          <div className="mx-auto my-auto w-full max-w-md rounded-[28px] bg-surface-container px-5 py-8 text-center">
            <DoorOpen
              size={22}
              strokeWidth={1.75}
              className="mx-auto text-residential"
            />
            <p className="mt-3 text-title-md tracking-tight">Log in to request leave</p>
            <p className="mt-2 text-body-md text-on-surface-variant">
              Same Google account as the schedule. Day leave is auto approved.
            </p>
            <button
              type="button"
              className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary"
              onClick={() => onOpenLogin?.()}
            >
              Log in
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pb-10">
            {auth.role === "staff" ? (
              <p className="rounded-2xl bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
                Staff approvals come later. You can see student requests here.
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-2xl bg-residential-container px-4 py-3 text-body-md text-on-residential-container">
                {notice}
              </p>
            ) : null}
            {inviteError ? (
              <p className="text-body-md text-error">{inviteError}</p>
            ) : null}

            {auth.role === "student" && auth.studentId ? (
              <StudentQrCard
                studentId={auth.studentId}
                name={auth.displayName ?? "Student"}
              />
            ) : null}

            {invites.length > 0 ? (
              <section>
                <h2 className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
                  Invites
                </h2>
                <div className="mt-3 grid gap-3">
                  {invites.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-[24px] bg-residential-container px-4 py-4"
                    >
                      <p className="text-title-md tracking-tight text-on-residential-container">
                        Join {studentName(students, request.studentId)}
                      </p>
                      <p className="mt-1 text-body-md text-on-residential-container/80">
                        {leaveTypeMeta(request.leaveType).label} · {request.destination}
                      </p>
                      <p className="mt-1 text-label-sm text-on-residential-container/70">
                        {formatReachRange(request.startsAt, request.endsAt)}
                      </p>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          className="h-10 flex-1 rounded-full bg-residential text-label-sm tracking-wide text-on-residential"
                          onClick={() => void answerInvite(request.id, true)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="h-10 flex-1 rounded-full bg-surface-container-lowest text-label-sm tracking-wide text-on-surface"
                          onClick={() => void answerInvite(request.id, false)}
                        >
                          Decline
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
                {auth.role === "staff" ? "All requests" : "Your leaves"}
              </h2>
              {!loaded ? (
                <p className="mt-3 text-body-md text-on-surface-variant">Loading…</p>
              ) : (auth.role === "staff" ? requests : mine).length === 0 ? (
                <div className="mx-auto mt-10 max-w-sm text-center">
                  <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-residential-container text-residential">
                    <DoorOpen size={22} strokeWidth={1.6} aria-hidden />
                  </span>
                  <h3 className="mt-5 text-headline-lg-mobile tracking-tight">
                    No leave yet
                  </h3>
                  <p className="mt-2 text-body-md text-on-surface-variant">
                    Day leave from 6 AM to 6 PM is auto approved. Evenings and
                    overnights wait for RC.
                  </p>
                </div>
              ) : (
                <div className="mt-3 grid gap-3">
                  {(auth.role === "staff" ? requests : mine).map((request) => (
                    <ReachRequestCard
                      key={request.id}
                      request={request}
                      students={students}
                      canAttach={
                        request.createdBy === auth.profileId ||
                        request.studentId === auth.studentId
                      }
                      onAttached={() => void refresh()}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function studentName(students: Student[], id: string) {
  return students.find((student) => student.id === id)?.name ?? "A student";
}

function ReachRequestCard({
  request,
  students,
  canAttach,
  onAttached,
}: {
  request: ReachRequest;
  students: Student[];
  canAttach: boolean;
  onAttached: () => void;
}) {
  const [attachError, setAttachError] = useState<string | null>(null);
  const owner = studentName(students, request.studentId);
  const needsDocs =
    request.leaveType === "overnight" && request.documents.length === 0;

  async function onFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setAttachError(null);
    const result = await uploadReachDocuments(request.id, files);
    if (result.error) setAttachError(result.error);
    onAttached();
  }

  return (
    <article className="rounded-[24px] bg-surface-container px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-title-md tracking-tight">
            {leaveTypeMeta(request.leaveType).label}
          </p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            {request.destination}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-label-sm tracking-wide ${
            request.status === "approved" || request.status === "returned"
              ? "bg-residential-container text-on-residential-container"
              : request.status === "pending" || request.status === "active"
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-error-container text-on-error-container"
          }`}
        >
          {statusLabel(request.status)}
        </span>
      </div>
      <p className="mt-3 text-label-sm text-on-surface-variant">
        {formatReachRange(request.startsAt, request.endsAt)}
      </p>
      <p className="mt-1 text-label-sm text-on-surface-variant">
        {request.transports.map(transportLabel).join(" → ")} · {owner}
      </p>
      {request.companions.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {request.companions.map((companion) => (
            <li
              key={companion.studentId}
              className="flex items-center gap-1.5 rounded-full bg-surface-container-lowest py-1 pr-2.5 pl-1 text-label-sm"
            >
              <span
                className="flex size-6 items-center justify-center rounded-full bg-surface-container text-[10px] font-semibold"
                aria-hidden
              >
                {initials(studentName(students, companion.studentId))}
              </span>
              {studentName(students, companion.studentId).split(" ")[0]}
              <span className="text-on-surface-variant">
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
        <p className="mt-3 text-body-md text-on-surface-variant">
          Host {request.hostName}
          {request.hostPhone ? ` · ${request.hostPhone}` : ""}
        </p>
      ) : null}
      {request.documents.length > 0 ? (
        <p className="mt-3 text-label-sm text-on-surface-variant">
          {request.documents.length} document
          {request.documents.length === 1 ? "" : "s"} attached
        </p>
      ) : null}
      {needsDocs && canAttach ? (
        <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-2xl bg-surface-container-lowest px-3 py-3 text-body-md">
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
      {attachError ? <p className="mt-2 text-body-md text-error">{attachError}</p> : null}
    </article>
  );
}
