import { MapPin } from "lucide-react";
import { initials } from "../lib/classDetail";
import { useNow } from "../lib/now";
import { findById } from "../lib/people";
import {
  eventIsSoldOut,
  formatEventListTime,
  isSchoolEventLive,
  type SchoolEvent,
} from "../lib/schoolEvents";
import type { Student } from "../types";

const POSTERS = [
  { bg: "#141414", fg: "#f4efe4", accent: "#d4a574", shape: "arc" },
  { bg: "#162016", fg: "#e7f0d8", accent: "#8fbc5a", shape: "leaf" },
  { bg: "#1c1410", fg: "#f3e6d0", accent: "#e07a4c", shape: "slash" },
  { bg: "#101820", fg: "#dce8f0", accent: "#6eb0d4", shape: "ring" },
  { bg: "#1a1610", fg: "#f5e6c8", accent: "#e8c547", shape: "diamond" },
  { bg: "#201414", fg: "#f4e0d8", accent: "#d46a5c", shape: "arc" },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function avatarColor(name: string): string {
  const hue = hashString(name) % 360;
  return `oklch(0.62 0.12 ${hue})`;
}

function EventPoster({ event }: { event: SchoolEvent }) {
  const seed = hashString(event.id + event.title);
  const palette = POSTERS[seed % POSTERS.length];
  const words = event.title
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => (word.length > 12 ? `${word.slice(0, 11)}…` : word));

  return (
    <svg
      viewBox="0 0 88 88"
      className="size-full"
      aria-hidden
    >
      <rect width="88" height="88" rx="12" fill={palette.bg} />
      {palette.shape === "arc" ? (
        <path
          d="M-8 96 C 20 20, 70 20, 96 96"
          fill="none"
          stroke={palette.accent}
          strokeWidth="10"
          opacity="0.55"
        />
      ) : null}
      {palette.shape === "leaf" ? (
        <circle cx="70" cy="18" r="22" fill={palette.accent} opacity="0.35" />
      ) : null}
      {palette.shape === "slash" ? (
        <rect
          x="54"
          y="-10"
          width="18"
          height="120"
          rx="4"
          fill={palette.accent}
          opacity="0.4"
          transform="rotate(18 64 44)"
        />
      ) : null}
      {palette.shape === "ring" ? (
        <circle
          cx="68"
          cy="68"
          r="20"
          fill="none"
          stroke={palette.accent}
          strokeWidth="7"
          opacity="0.5"
        />
      ) : null}
      {palette.shape === "diamond" ? (
        <rect
          x="52"
          y="8"
          width="26"
          height="26"
          rx="3"
          fill={palette.accent}
          opacity="0.45"
          transform="rotate(32 65 21)"
        />
      ) : null}
      {words.map((word, index) => (
        <text
          key={`${word}-${index}`}
          x="10"
          y={34 + index * 16}
          fill={palette.fg}
          fontSize={words.join("").length > 18 ? 11 : 13}
          fontWeight="700"
          fontFamily="Inter Variable, ui-sans-serif, system-ui, sans-serif"
        >
          {word}
        </text>
      ))}
    </svg>
  );
}

function Face({ name }: { name: string }) {
  return (
    <span
      className="flex size-[18px] items-center justify-center rounded-full text-[8px] font-semibold text-white ring-2 ring-[#f4f4f4] md:size-5 md:text-[9px]"
      style={{ background: avatarColor(name) }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

function modeTag(event: SchoolEvent): string | null {
  if (event.status === "cancelled" || event.status === "rejected") return null;
  if (event.status === "pending") return null;
  if (event.mode === "mandatory") return "Mandatory";
  if (event.mode === "invite") return "Invite";
  if (event.mode === "open") return "Open";
  return "Note";
}

function statusTag(event: SchoolEvent): { label: string; kind: "meta" | "alert" | "ok" } | null {
  if (event.status === "cancelled") return { label: "Cancelled", kind: "alert" };
  if (event.status === "pending") return { label: "Pending approval", kind: "meta" };
  if (event.status === "rejected") return { label: "Declined", kind: "alert" };
  if (eventIsSoldOut(event)) return { label: "Sold Out", kind: "alert" };
  if (event.myStatus === "waitlisted") return { label: "Waitlist", kind: "alert" };
  if (event.myStatus === "going" && event.mode !== "mandatory") {
    return { label: "Going", kind: "ok" };
  }
  return null;
}

export function EventListCard({
  event,
  students,
  onOpen,
}: {
  event: SchoolEvent;
  students: Student[];
  onOpen: () => void;
}) {
  const now = useNow();
  const live = isSchoolEventLive(event, now.getTime());
  const host = event.hostName?.trim() || null;
  const guests = event.goingIds
    .map((id) => findById(students, id))
    .filter((person): person is Student => Boolean(person))
    .slice(0, 3);
  const meta = modeTag(event);
  const status = statusTag(event);

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-[16px] bg-[#f4f4f4] p-3 text-left text-[#171717] ring-1 ring-black/[0.04] transition-colors hover:bg-[#ececec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 md:gap-4 md:rounded-[18px] md:p-4 ${
        event.status === "cancelled" || event.status === "rejected"
          ? "opacity-60"
          : ""
      }`}
      onClick={onOpen}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[13px] text-[#737373] md:text-sm">
          {live ? (
            <span className="flex items-center gap-1 font-semibold tracking-wide text-[#e85d2c] uppercase">
              <span className="size-1.5 rounded-full bg-[#e85d2c]" />
              Live
            </span>
          ) : null}
          <span>{formatEventListTime(event)}</span>
        </p>
        <h3
          className={`mt-1 text-[16px] leading-5 font-semibold text-[#171717] md:text-lg md:leading-6 ${
            event.status === "cancelled" || event.status === "rejected"
              ? "line-through"
              : ""
          }`}
        >
          {event.title}
        </h3>
        {host ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#737373] md:text-sm">
            <Face name={host} />
            <span className="min-w-0 truncate">By {host}</span>
          </p>
        ) : null}
        {event.location ? (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#737373] md:text-sm">
            <MapPin size={14} strokeWidth={1.75} className="shrink-0 md:size-4" aria-hidden />
            <span className="min-w-0 truncate">{event.location}</span>
          </p>
        ) : null}
        {meta || status || event.goingCount > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {meta ? (
              <span className="rounded-full bg-[#efe6d8] px-2 py-0.5 text-[11px] font-medium text-[#8a6a3d] md:text-xs">
                {meta}
              </span>
            ) : null}
            {status ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium md:text-xs ${
                  status.kind === "alert"
                    ? "bg-[#fde8e4] text-[#c23a2e]"
                    : status.kind === "ok"
                      ? "bg-[#e8f3e4] text-[#3d7a3a]"
                      : "bg-[#ececec] text-[#555]"
                }`}
              >
                {status.label}
              </span>
            ) : null}
            {event.goingCount > 0 ? (
              <span className="ml-0.5 flex items-center">
                {guests.length > 0 ? (
                  <span className="flex -space-x-1.5">
                    {guests.map((person) => (
                      <Face key={person.id} name={person.name} />
                    ))}
                  </span>
                ) : null}
                <span className="ml-1.5 text-[13px] text-[#737373] md:text-sm">
                  +{event.goingCount}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="size-[72px] shrink-0 overflow-hidden rounded-[12px] ring-1 ring-black/5 sm:size-[88px] md:size-[104px] md:rounded-[14px]">
        <EventPoster event={event} />
      </div>
    </button>
  );
}
