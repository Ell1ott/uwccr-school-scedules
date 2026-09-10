import { Calendar, Compass, Shuffle, Sparkles } from "lucide-react";
import type { AppTabId } from "./AppHeader";

const TABS = [
  { id: "week", hint: "Schedule" },
  { id: "events", hint: "Events" },
  { id: "cas", hint: "CAS" },
  { id: "classes", hint: "Try classes" },
] as const satisfies readonly { id: AppTabId; hint: string }[];

export function MobileTabBar({
  tab,
  onTabChange,
  hidden = false,
}: {
  tab: AppTabId;
  onTabChange: (tab: AppTabId) => void;
  hidden?: boolean;
}) {
  const selectedIndex = Math.max(
    0,
    TABS.findIndex((item) => item.id === tab),
  );

  return (
    <nav
      className={`mobile-tab-bar ${hidden ? "mobile-tab-bar-hidden" : ""}`}
      aria-label="Main"
      aria-hidden={hidden}
      inert={hidden || undefined}
    >
      <div role="tablist" aria-label="Views" className="mobile-tab-bar-glass">
        <span
          className="mobile-tab-bar-indicator"
          style={{ transform: `translateX(${selectedIndex * 100}%)` }}
          aria-hidden
        />
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-label={item.hint}
              aria-selected={selected}
              aria-controls={`${item.id}-panel`}
              className="mobile-tab-bar-item"
              onClick={() => onTabChange(item.id)}
            >
              <TabGlyph id={item.id} selected={selected} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function TabGlyph({ id, selected }: { id: AppTabId; selected: boolean }) {
  const props = {
    size: 24,
    strokeWidth: selected ? 2 : 1.7,
    fill: selected ? "currentColor" : "none",
    className: selected ? "[fill-opacity:0.16]" : undefined,
    "aria-hidden": true as const,
  };

  if (id === "events") return <Sparkles {...props} />;
  if (id === "cas") return <Compass {...props} />;
  if (id === "classes") return <Shuffle {...props} />;
  return <Calendar {...props} />;
}
