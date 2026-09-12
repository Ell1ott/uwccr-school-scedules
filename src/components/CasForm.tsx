import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import {
  createCas,
  notifyCasModeration,
  updateCas,
  type CasGroup,
} from "../lib/cas";
import { searchPeople } from "../lib/people";
import type { Student } from "../types";

export function CasForm({
  students,
  editing,
  onDone,
  onCancel,
}: {
  students: Student[];
  editing?: CasGroup | null;
  onDone: (casId?: string) => void;
  onCancel: () => void;
}) {
  const auth = useAuth();
  const needsApproval = auth.role === "student";
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [query, setQuery] = useState("");
  const [leaderIds, setLeaderIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyToken, setNotifyToken] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const candidates = searchPeople(students, query).slice(0, 8);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the CAS a title.");
      return;
    }
    setBusy(true);
    if (editing) {
      const message = await updateCas(editing.id, {
        title: trimmed,
        description: description.trim(),
        location: location.trim(),
      });
      setBusy(false);
      if (message) setError(message);
      else onDone(editing.id);
      return;
    }
    const created = await createCas({
      title: trimmed,
      description: description.trim(),
      location: location.trim(),
      leaderStudentIds: auth.role === "staff" ? leaderIds : [],
    });
    if (created.error) {
      setBusy(false);
      setError(created.error);
      return;
    }
    if (needsApproval && created.moderationToken) {
      const notifyError = await notifyCasModeration(
        created.moderationToken,
        window.location.origin,
      );
      setBusy(false);
      if (notifyError) {
        setNotifyToken(created.moderationToken);
        setCreatedId(created.casId);
        setError(`Saved, but we could not email admins: ${notifyError}`);
        return;
      }
      onDone(created.casId ?? undefined);
      return;
    }
    setBusy(false);
    onDone(created.casId ?? undefined);
  }

  async function retryNotify() {
    if (!notifyToken) return;
    setBusy(true);
    setError(null);
    const notifyError = await notifyCasModeration(
      notifyToken,
      window.location.origin,
    );
    setBusy(false);
    if (notifyError) setError(notifyError);
    else onDone(createdId ?? undefined);
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)}>
      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Title
        <input
          required
          value={title}
          placeholder="Tennis, Football, Kindergarten…"
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>
      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        Where
        <input
          value={location}
          placeholder="Courts, field, town…"
          onChange={(event) => setLocation(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>
      <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
        About
        <textarea
          value={description}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-2 w-full rounded-2xl bg-surface-container px-4 py-3 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>

      {auth.role === "staff" && !editing ? (
        <div>
          <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
            Student leaders
          </p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search students"
            className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          {leaderIds.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {leaderIds.map((id) => {
                const student = students.find((item) => item.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="h-8 rounded-full bg-primary px-3 text-label-sm text-on-primary"
                    onClick={() =>
                      setLeaderIds((current) => current.filter((item) => item !== id))
                    }
                  >
                    {student?.name ?? id} ×
                  </button>
                );
              })}
            </div>
          ) : null}
          {query.trim() ? (
            <ul className="mt-2 overflow-hidden rounded-2xl bg-surface-container">
              {candidates.map((student) => {
                const added = leaderIds.includes(student.id);
                return (
                  <li key={student.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-body-md"
                      onClick={() =>
                        setLeaderIds((current) =>
                          added
                            ? current.filter((id) => id !== student.id)
                            : [...current, student.id],
                        )
                      }
                    >
                      <span>{student.name}</span>
                      <span className="text-label-sm text-on-surface-variant">
                        {added ? "Added" : student.cohort}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

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
                : "Create CAS"}
        </button>
      </div>
    </form>
  );
}
