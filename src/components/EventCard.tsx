import { usePalette } from "../lib/palette";
import { isBandKind, toneForEvent } from "../lib/tones";
import type { ScheduleEvent } from "../types";

function Icon({ name, className = "text-[14px]" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`}>{name}</span>
  );
}

export function EventCard({
  event,
  compact = false,
  fill = false,
}: {
  event: ScheduleEvent;
  compact?: boolean;
  fill?: boolean;
}) {
  const { palette } = usePalette();
  const tone = toneForEvent(event, palette);
  const padding = compact ? "px-2.5 py-2" : "px-3 py-2.5";
  const minHeight = fill || compact ? "" : "min-h-[7.5rem]";

  if (isBandKind(event.kind)) {
    return (
      <div
        className={`flex h-full items-center justify-center rounded-lg bg-surface-container ${
          compact ? "py-1.5" : "py-2.5"
        }`}
      >
        <span className="font-medium text-label-sm tracking-[0.2em] text-black uppercase flex items-center gap-1.5">
          {event.icon ? <Icon name={event.icon} /> : null}
          {event.title}
        </span>
      </div>
    );
  }

  if (event.kind === "study") {
    return (
      <div
        className={`flex h-full items-center gap-2.5 rounded-[10px] bg-surface-container-lowest shadow-[inset_0_2px_8px_rgba(0,0,0,0.02)] ${padding} ${minHeight}`}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-container">
          <Icon name={event.icon ?? "local_library"} className="text-[16px]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-5 text-black">
            {event.title}
          </h3>
          <p className="text-label-sm text-black">
            {event.subtitle}
            {event.block ? ` · Block ${event.block}` : ""}
          </p>
        </div>
      </div>
    );
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

  return (
    <div
      className={`relative h-full overflow-hidden rounded-[10px] shadow-[0_4px_12px_rgba(4,22,39,0.05)] transition-colors duration-300 ${tone.bg} ${tone.text} ${padding} ${minHeight}`}
      style={tone.bgColor ? { backgroundColor: tone.bgColor } : undefined}
    >
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
        {event.teacher ? (
          <p className="flex items-center gap-1">
            <Icon name="person" /> {event.teacher}
          </p>
        ) : null}
        {event.room ? (
          <p className="flex items-center gap-1">
            <Icon name="meeting_room" /> Rm {event.room}
          </p>
        ) : null}
        {!compact && event.subtitle && !event.teacher ? (
          <p className="flex items-center gap-1">
            <Icon name={event.icon ?? "info"} /> {event.subtitle}
          </p>
        ) : null}
        {compact && event.subtitle && !event.teacher ? (
          <p>{event.subtitle}</p>
        ) : null}
        {event.extras?.map((extra) => (
          <p key={`${extra.subject}-${extra.teacher}`} className="flex items-center gap-1">
            <Icon name="warning" /> {extra.subject} {extra.level} · {extra.teacher}
          </p>
        ))}
      </div>
    </div>
  );
}
