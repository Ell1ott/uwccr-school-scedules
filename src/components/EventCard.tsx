import { EventIcon } from "../lib/icons";
import { usePalette } from "../lib/palette";
import { formatCohorts } from "../lib/teachers";
import { isBandKind, toneForEvent } from "../lib/tones";
import type { DayId, ScheduleEvent } from "../types";
import { LiveNowBadge } from "./LiveNowBadge";

export function EventCard({
  event,
  compact = false,
  fill = false,
  dayId,
  onOpen,
}: {
  event: ScheduleEvent;
  compact?: boolean;
  fill?: boolean;
  dayId?: DayId;
  onOpen?: (event: ScheduleEvent) => void;
}) {
  const { palette } = usePalette();
  const tone = toneForEvent(event, palette);
  const padding = compact ? "px-2.5 py-2" : "px-3 py-2.5";
  const minHeight = fill || compact ? "" : "min-h-[7.5rem]";
  const live = dayId && !isBandKind(event.kind) ? (
    <LiveNowBadge dayId={dayId} startMin={event.startMin} endMin={event.endMin} />
  ) : null;

  if (isBandKind(event.kind)) {
    return (
      <div
        className={`flex h-full items-center justify-center rounded-lg bg-surface-container ${
          compact ? "py-1.5" : "py-2.5"
        }`}
      >
        <span className="font-medium text-label-sm tracking-[0.2em] text-black uppercase flex items-center gap-1.5">
          {event.icon ? <EventIcon name={event.icon} /> : null}
          {event.title}
        </span>
      </div>
    );
  }

  if (event.kind === "study") {
    const interactive = Boolean(onOpen) && Boolean(event.block);
    const className = `relative flex h-full w-full items-center justify-center gap-2 appearance-none ${
      fill || compact ? "" : "min-h-[7.5rem]"
    } ${
      interactive
        ? "cursor-pointer rounded-[10px] hover:bg-black/[0.03] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        : ""
    }`;
    const body = (
      <>
        <span className="text-[13px] font-medium tracking-wide text-black/45">
          {event.title}
        </span>
        {event.block ? (
          <span className="rounded-full bg-black/[0.06] px-2 py-px text-[10px] font-medium tracking-wide text-black/50">
            {event.block}
          </span>
        ) : null}
        {live}
      </>
    );
    if (interactive) {
      return (
        <button
          type="button"
          className={className}
          aria-haspopup="dialog"
          aria-label={`${event.title} details`}
          onClick={() => onOpen?.(event)}
        >
          {body}
        </button>
      );
    }
    return <div className={className}>{body}</div>;
  }

  const chipLabel =
    event.extras && event.extras.length > 0
      ? "Conflict"
      : event.level && event.level !== event.title
        ? event.block
          ? `${event.level} · ${event.block}`
          : event.level
        : event.block
          ? `Block ${event.block}`
          : null;

  const interactive = event.kind === "class" && Boolean(onOpen);
  const className = `relative flex h-full flex-col justify-start overflow-hidden rounded-[10px] shadow-[0_4px_12px_rgba(4,22,39,0.05)] transition-[filter,box-shadow,transform] duration-200 ${tone.bg} ${tone.text} ${padding} ${minHeight} ${
    interactive
      ? "w-full appearance-none cursor-pointer text-left hover:brightness-[0.97] hover:shadow-[0_6px_16px_rgba(4,22,39,0.1)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      : ""
  }`;
  const style = tone.bgColor ? { backgroundColor: tone.bgColor } : undefined;
  const body = (
    <>
      <div className="absolute top-0 bottom-0 left-0 w-1" />
      <div className={`flex items-start justify-between gap-2 ${compact ? "mb-0.5" : "mb-1.5"}`}>
        <h3 className="text-[15px] font-semibold leading-5">
          {event.title}
        </h3>
        {chipLabel ? (
          <div
            className={`flex-shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide ${tone.chip} ${
              event.extras ? "bg-error-container text-black" : ""
            }`}
          >
            {chipLabel}
          </div>
        ) : null}
      </div>
      <div className={`flex flex-col text-[12px] leading-4 ${compact ? "gap-0.5" : "gap-0.5"}`}>
        {event.studentCount != null ? (
          <p className="flex items-center gap-1">
            <EventIcon name="users" />{" "}
            {event.studentCount}{" "}
            {event.studentCount === 1 ? "student" : "students"}
            {event.cohorts && event.cohorts.length > 0
              ? ` · ${formatCohorts(event.cohorts)}`
              : ""}
          </p>
        ) : event.teacher ? (
          <p className="flex items-center gap-1">
            <EventIcon name="user" /> {event.teacher}
          </p>
        ) : null}
        {event.room ? (
          <p className="flex items-center gap-1">
            <EventIcon name="door-open" /> Rm {event.room}
          </p>
        ) : null}
        {!compact && event.subtitle && event.studentCount == null && !event.teacher ? (
          <p className="flex items-center gap-1">
            <EventIcon name={event.icon ?? "info"} /> {event.subtitle}
          </p>
        ) : null}
        {compact && event.subtitle && event.studentCount == null && !event.teacher ? (
          <p>{event.subtitle}</p>
        ) : null}
        {event.extras?.map((extra) => (
          <p key={`${extra.subject}-${extra.teacher}`} className="flex items-center gap-1">
            <EventIcon name="warning" /> {extra.subject} {extra.level}
            {event.studentCount == null ? ` · ${extra.teacher}` : extra.room ? ` · Rm ${extra.room}` : ""}
          </p>
        ))}
      </div>
      {live}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        aria-haspopup="dialog"
        aria-label={`${event.title} class details`}
        onClick={() => onOpen?.(event)}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      {body}
    </div>
  );
}
