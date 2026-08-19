import { Users } from "lucide-react";

export function CommunityToggle({
  on,
  onChange,
  showLabel,
  className,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Community meeting week"
      className={`flex h-10 flex-shrink-0 items-center gap-2 rounded-full bg-surface-container px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${className ?? ""}`}
      onClick={() => onChange(!on)}
    >
      <Users
        size={14}
        strokeWidth={1.75}
        className="shrink-0 text-on-surface-variant"
        aria-hidden
      />
      <span
        className={`${showLabel ? "flex-1 text-left" : "hidden sm:inline"} text-label-sm tracking-wide text-on-surface-variant`}
      >
        Community
      </span>
      <span
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${
          on ? "bg-emerald-500" : "bg-outline-variant"
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
            on ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}
