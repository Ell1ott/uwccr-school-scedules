import { CalendarPlus, Compass } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import {
  CAS_FILTERS,
  joinCas,
  type CasFilterId,
  type CasGroup,
  type CasSession,
} from "../lib/cas";
import type { Student, Teacher } from "../types";
import { CasCard } from "./CasCard";
import { CasDetail } from "./CasDetail";
import { CasForm } from "./CasForm";
import { CasSessionForm } from "./CasSessionForm";
import { FloatingTabs } from "./FloatingTabs";
import { MobileHubButton } from "./MobileHub";

export type CasDraft = "new" | "edit" | "session-new" | "session-edit";

export function CasPage({
  groups,
  students,
  teachers,
  casId,
  sessionId,
  draft,
  onOpenCas,
  onOpenSession,
  onDraftChange,
  onOpenLogin,
  hubOpen,
  onOpenHub,
}: {
  groups: CasGroup[];
  students: Student[];
  teachers: Teacher[];
  casId?: string;
  sessionId?: string;
  draft: CasDraft | null;
  onOpenCas: (group: CasGroup) => void;
  onOpenSession: (group: CasGroup, session: CasSession) => void;
  onDraftChange: (draft: CasDraft | null, casId?: string) => void;
  onOpenLogin?: () => void;
  hubOpen?: boolean;
  onOpenHub?: () => void;
}) {
  const auth = useAuth();
  const [filter, setFilter] = useState<CasFilterId>("mine");
  const loggedOut = !auth.session || !auth.role;
  const selected = casId ? groups.find((group) => group.id === casId) ?? null : null;
  const editingSession = sessionId
    ? selected?.sessions.find((session) => session.id === sessionId) ?? null
    : null;

  const mine = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.iAmMember || group.createdBy === auth.profileId,
      ),
    [groups, auth.profileId],
  );
  const discover = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.status === "published" &&
          !group.iAmMember &&
          group.createdBy !== auth.profileId,
      ),
    [groups],
  );
  const shown = filter === "mine" ? mine : discover;

  if (draft === "new" || (draft === "edit" && selected)) {
    return (
      <div className="px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-mobile-nav md:px-container-padding-desktop md:pt-8 md:pb-16">
        <div className="mx-auto max-w-2xl">
          <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            CAS
          </p>
          <h1 className="mt-1 text-headline-lg-mobile tracking-tight">
            {draft === "new" ? "New CAS" : "Edit CAS"}
          </h1>
          <div className="mt-6">
            <CasForm
              students={students}
              editing={draft === "edit" ? selected : null}
              onDone={(id) => onDraftChange(null, id)}
              onCancel={() => onDraftChange(null, selected?.id)}
            />
          </div>
        </div>
      </div>
    );
  }

  if (selected && (draft === "session-new" || draft === "session-edit")) {
    return (
      <div className="px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-mobile-nav md:px-container-padding-desktop md:pt-8 md:pb-16">
        <div className="mx-auto max-w-2xl">
          <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            {selected.title}
          </p>
          <h1 className="mt-1 text-headline-lg-mobile tracking-tight">
            {draft === "session-new" ? "New session" : "Edit session"}
          </h1>
          <div className="mt-6">
            <CasSessionForm
              group={selected}
              editing={draft === "session-edit" ? editingSession : null}
              onDone={() => onDraftChange(null, selected.id)}
              onCancel={() => onDraftChange(null, selected.id)}
            />
          </div>
        </div>
      </div>
    );
  }

  if (casId && !selected && draft == null) {
    return (
      <div className="px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+4rem)] text-center text-body-md text-on-surface-variant md:px-container-padding-desktop">
        Opening this CAS…
      </div>
    );
  }

  if (selected && draft == null) {
    return (
      <CasDetail
        group={selected}
        students={students}
        teachers={teachers}
        onOpenSession={(session) => onOpenSession(selected, session)}
        onEdit={() => onDraftChange("edit", selected.id)}
        onAddSession={() => onDraftChange("session-new", selected.id)}
        onLeft={() => onDraftChange(null)}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col md:min-h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))]">
      <div className="sticky top-0 z-40 bg-surface-container-lowest/80 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-md md:static md:bg-transparent md:px-container-padding-desktop md:pt-8 md:shadow-none md:backdrop-blur-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
              After classes
            </p>
            <h1 className="text-headline-lg-mobile tracking-tight">CAS</h1>
          </div>
          <div className="flex items-center gap-2">
            {auth.role === "staff" || auth.role === "student" ? (
              <button
                type="button"
                className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-3 text-label-sm tracking-wide text-on-primary"
                onClick={() => onDraftChange("new")}
              >
                <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
                New
              </button>
            ) : null}
            {onOpenHub ? (
              <MobileHubButton
                className="md:hidden"
                expanded={hubOpen}
                onClick={onOpenHub}
              />
            ) : null}
          </div>
        </div>
        {loggedOut ? null : (
          <div className="mt-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="event-filters w-max rounded-2xl bg-surface-container p-1">
              <FloatingTabs
                value={filter}
                options={CAS_FILTERS}
                onChange={setFilter}
                ariaLabel="CAS filters"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-container-padding-mobile pb-mobile-nav md:px-container-padding-desktop md:pb-24">
        {loggedOut ? (
          <div className="mx-auto my-auto w-full max-w-md rounded-[28px] bg-surface-container px-5 py-8 text-center">
            <Compass size={22} strokeWidth={1.75} className="mx-auto text-primary" />
            <p className="mt-3 text-title-md tracking-tight">Log in to see yours</p>
            <p className="mt-2 text-body-md text-on-surface-variant">
              Join a CAS and the sessions land on your week. Leaders plan the times.
            </p>
            <button
              type="button"
              className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary"
              onClick={() => onOpenLogin?.()}
            >
              Log in
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4 text-center">
            <span
              className="flex size-14 items-center justify-center rounded-full bg-[oklch(0.93_0.055_147)] text-black/55"
              aria-hidden
            >
              <Compass size={22} strokeWidth={1.6} />
            </span>
            <h2 className="mt-5 text-headline-lg-mobile tracking-tight">
              {filter === "mine" ? "Nothing joined yet" : "Everyone is in"}
            </h2>
            <p className="mt-2 text-body-md text-on-surface-variant">
              {filter === "mine"
                ? "Discover a CAS, or start one if you lead it."
                : "Every published CAS is already on your list."}
            </p>
          </div>
        ) : (
          <ul className="mx-auto flex w-full max-w-2xl flex-col gap-3 md:mx-0">
            {shown.map((group) => (
              <li key={group.id}>
                {filter === "discover" ? (
                  <div className="flex flex-col gap-2">
                    <CasCard group={group} onOpen={() => onOpenCas(group)} />
                    {auth.role === "student" ? (
                      <button
                        type="button"
                        className="h-10 rounded-full bg-primary text-label-sm tracking-wide text-on-primary"
                        onClick={() => void joinCas(group.id)}
                      >
                        Join
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <CasCard group={group} onOpen={() => onOpenCas(group)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
