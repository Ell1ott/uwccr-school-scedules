import { MapPin, Users } from "lucide-react";
import type { CasGroup } from "../lib/cas";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const POSTERS = [
  { bg: "#142018", fg: "#e7f0d8", accent: "#7dba6a" },
  { bg: "#101820", fg: "#dce8f0", accent: "#6eb0d4" },
  { bg: "#1a1610", fg: "#f5e6c8", accent: "#e8c547" },
  { bg: "#1c1410", fg: "#f3e6d0", accent: "#e07a4c" },
] as const;

function CasPoster({ title, id }: { title: string; id: string }) {
  const seed = hashString(id + title);
  const palette = POSTERS[seed % POSTERS.length];
  const words = title
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => (word.length > 12 ? `${word.slice(0, 11)}…` : word));

  return (
    <svg viewBox="0 0 88 88" className="size-full" aria-hidden>
      <rect width="88" height="88" rx="12" fill={palette.bg} />
      <circle cx="72" cy="16" r="20" fill={palette.accent} opacity="0.35" />
      {words.map((word, index) => (
        <text
          key={`${word}-${index}`}
          x="10"
          y={36 + index * 16}
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

function nextLine(group: CasGroup): string | null {
  if (group.status === "pending") return "Pending approval";
  if (group.status === "rejected") return "Declined";
  if (!group.nextSession) return "No sessions yet";
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Costa_Rica",
  }).format(new Date(group.nextSession.startsAt));
  return when;
}

export function CasCard({
  group,
  onOpen,
}: {
  group: CasGroup;
  onOpen: () => void;
}) {
  const leaders = group.leaders
    .map((leader) => leader.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const faded = group.status === "rejected" || group.status === "archived";

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-[16px] bg-[#f4f4f4] p-3 text-left text-[#171717] ring-1 ring-black/[0.04] transition-colors hover:bg-[#ececec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 md:gap-4 md:rounded-[18px] md:p-4 ${
        faded ? "opacity-55" : ""
      }`}
      onClick={onOpen}
    >
      <div className="size-[72px] shrink-0 overflow-hidden rounded-[12px] md:size-20">
        <CasPoster title={group.title} id={group.id} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="truncate text-[16px] font-semibold tracking-tight">
            {group.title}
          </h2>
          {group.iAmLeader ? (
            <span className="rounded-full bg-black/8 px-2 py-0.5 text-[10px] font-medium tracking-wide">
              Leader
            </span>
          ) : null}
          {group.status === "pending" ? (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium tracking-wide">
              Pending
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-black/55">
          {nextLine(group)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-black/50">
          {group.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} strokeWidth={1.75} aria-hidden />
              {group.location}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users size={11} strokeWidth={1.75} aria-hidden />
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </span>
        </div>
        {leaders ? (
          <p className="mt-1 truncate text-[12px] text-black/45">{leaders}</p>
        ) : null}
      </div>
    </button>
  );
}
