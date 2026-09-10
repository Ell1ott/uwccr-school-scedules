import { CalendarPlus, Sparkles } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { useNow } from "../lib/now";
import {
  EVENT_FILTERS,
  crDate,
  eventCoversDate,
  groupEventsByDay,
  isSchoolEventPast,
  matchesEventFilter,
  type EventFilterId,
  type SchoolEvent,
} from "../lib/schoolEvents";
import type { Student } from "../types";
import { EventForm } from "./EventForm";
import { EventListCard } from "./EventListCard";
import { EventsMonthCalendar } from "./EventsMonthCalendar";
import { FloatingTabs } from "./FloatingTabs";
import { MobileHubButton } from "./MobileHub";

function emptyCopy(
  filter: EventFilterId,
  isStaff: boolean,
): { title: string; body: string } {
  const staffLine = isStaff
    ? "You can post a gathering whenever there's somewhere to be."
    : "Submit one for approval when there's somewhere to be.";

  if (filter === "all") {
    return {
      title: "Nothing on the books",
      body: `The calendar is keeping its own hours. ${staffLine}`,
    };
  }

  return {
    title: "Quiet in this corner",
    body: `No events match this filter. ${staffLine}`,
  };
}

export function EventsPage({
  students,
  events,
  draft,
  onDraftChange,
  onOpenLogin,
  onOpenEvent,
  hubOpen,
  onOpenHub,
}: {
  students: Student[];
  events: SchoolEvent[];
  draft: "create" | SchoolEvent | null;
  onDraftChange: (draft: "create" | SchoolEvent | null) => void;
  onOpenLogin?: () => void;
  onOpenEvent: (event: SchoolEvent) => void;
  hubOpen?: boolean;
  onOpenHub?: () => void;
}) {
  const auth = useAuth();
  const now = useNow();
  const nowMs = Math.floor(now.getTime() / 60_000) * 60_000;
  const [filter, setFilter] = useState<EventFilterId>("all");
  const [showPast, setShowPast] = useState(false);
  const pendingDay = useRef<string | null>(null);
  const composing = draft;
  const filtered = useMemo(
    () => events.filter((event) => matchesEventFilter(event, filter)),
    [events, filter],
  );
  const { past, upcoming } = useMemo(() => {
    const past: SchoolEvent[] = [];
    const upcoming: SchoolEvent[] = [];
    for (const event of filtered) {
      if (isSchoolEventPast(event, nowMs)) past.push(event);
      else upcoming.push(event);
    }
    return { past, upcoming };
  }, [filtered, nowMs]);
  const groups = useMemo(
    () => groupEventsByDay(showPast ? filtered : upcoming),
    [filtered, upcoming, showPast],
  );
  const loggedOut = !auth.session || !auth.role;

  useLayoutEffect(() => {
    const date = pendingDay.current;
    if (!date || !showPast) return;
    pendingDay.current = null;
    const covering = filtered.find((event) => eventCoversDate(event, date));
    const section =
      document.getElementById(`event-day-${date}`) ??
      (covering
        ? document.getElementById(`event-day-${crDate(covering.startsAt)}`)
        : null);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [filtered, groups, showPast]);

  if (composing) {
    return (
      <div className="px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-mobile-nav md:px-container-padding-desktop md:pt-8 md:pb-16">
        <div className="mx-auto max-w-2xl">
          <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            Events
          </p>
          <h1 className="mt-1 text-headline-lg-mobile tracking-tight">
            {composing === "create" ? "New event" : "Edit event"}
          </h1>
          <div className="mt-6">
            <EventForm
              students={students}
              editing={composing === "create" ? null : composing}
              onDone={() => onDraftChange(null)}
              onCancel={() => onDraftChange(null)}
            />
          </div>
        </div>
      </div>
    );
  }

  const empty = emptyCopy(filter, auth.role === "staff");

  function scrollToDay(date: string) {
    const direct = document.getElementById(`event-day-${date}`);
    if (direct) {
      direct.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const covering = filtered.find((event) => eventCoversDate(event, date));
    if (!covering) return;
    const section = document.getElementById(
      `event-day-${crDate(covering.startsAt)}`,
    );
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    pendingDay.current = date;
    setShowPast(true);
  }

  return (
    <div className="flex min-h-dvh flex-col md:min-h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))]">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-40 bg-surface-container-lowest/80 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-md md:static md:bg-transparent md:px-container-padding-desktop md:pt-8 md:shadow-none md:backdrop-blur-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
                  After classes
                </p>
                <h1 className="text-headline-lg-mobile tracking-tight">Events</h1>
              </div>
              <div className="flex items-center gap-2">
                {auth.role === "staff" || auth.role === "student" ? (
                  <button
                    type="button"
                    className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-3 text-label-sm tracking-wide text-on-primary"
                    onClick={() => onDraftChange("create")}
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
                    options={EVENT_FILTERS}
                    onChange={setFilter}
                    ariaLabel="Event filters"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col px-container-padding-mobile pb-mobile-nav md:px-container-padding-desktop md:pb-24">
            {loggedOut ? (
              <div className="mx-auto my-auto w-full max-w-md rounded-[28px] bg-surface-container px-5 py-8 text-center">
                <Sparkles size={22} strokeWidth={1.75} className="mx-auto text-primary" />
                <p className="mt-3 text-title-md tracking-tight">Log in to see yours</p>
                <p className="mt-2 text-body-md text-on-surface-variant">
                  Invitations, open signups, and mandatory meetings live here.
                  Class schedules still work without an account.
                </p>
                <button
                  type="button"
                  className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary"
                  onClick={() => onOpenLogin?.()}
                >
                  Log in
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4 text-center">
                <span
                  className="flex size-14 items-center justify-center rounded-full bg-[oklch(0.93_0.055_78)] text-black/55"
                  aria-hidden
                >
                  <Sparkles size={22} strokeWidth={1.6} />
                </span>
                <h2 className="mt-5 text-headline-lg-mobile tracking-tight">
                  {empty.title}
                </h2>
                <p className="mt-2 text-body-md text-on-surface-variant">
                  {empty.body}
                </p>
              </div>
            ) : (
              <div className="luma-timeline mx-auto w-full max-w-2xl md:mx-0 lg:max-w-none">
                {past.length > 0 ? (
                  <section
                    className={`luma-day is-toggle is-first${groups.length === 0 ? " is-last" : ""}`}
                  >
                    <div className="luma-day-line" aria-hidden />
                    <div className="luma-day-head">
                      <button
                        type="button"
                        className="luma-day-title"
                        aria-expanded={showPast}
                        onClick={() => setShowPast((open) => !open)}
                      >
                        <span className="luma-day-date">Past</span>
                        <span className="luma-day-weekday">
                          {showPast
                            ? "Hide"
                            : past.length === 1
                              ? "1 event"
                              : `${past.length} events`}
                        </span>
                      </button>
                      <span className="luma-day-dot" aria-hidden />
                    </div>
                    {groups.length === 0 ? (
                      <p className="text-body-md text-on-surface-variant">
                        Nothing upcoming right now.
                      </p>
                    ) : null}
                  </section>
                ) : null}
                {groups.map((group, index) => {
                  const groupPast = group.events.every((event) =>
                    isSchoolEventPast(event, nowMs),
                  );
                  return (
                    <section
                      key={group.date}
                      id={`event-day-${group.date}`}
                      className={`luma-day scroll-mt-24 md:scroll-mt-16${
                        index === 0 && past.length === 0 ? " is-first" : ""
                      }${index === groups.length - 1 ? " is-last" : ""}${
                        groupPast ? " is-past" : ""
                      }`}
                    >
                      <div className="luma-day-line" aria-hidden />
                      <div className="luma-day-head">
                        <h2 className="luma-day-title">
                          <span className="luma-day-date">{group.dateLabel}</span>
                          <span className="luma-day-weekday">
                            {group.weekdayLabel}
                          </span>
                        </h2>
                        <span className="luma-day-dot" aria-hidden />
                      </div>
                      <ul className="luma-day-cards">
                        {group.events.map((event) => (
                          <li key={event.id}>
                            <EventListCard
                              event={event}
                              students={students}
                              onOpen={() => onOpenEvent(event)}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {loggedOut ? null : (
          <EventsMonthCalendar
            events={filtered}
            onOpenEvent={onOpenEvent}
            onSelectDay={scrollToDay}
          />
        )}
      </div>
    </div>
  );
}
