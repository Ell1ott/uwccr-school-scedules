import {
  Calendar,
  LogIn,
  Plus,
  Settings,
  Settings2,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import { useEffect, useId, type ReactNode } from "react";
import type { AppTabId } from "./AppHeader";
import { ViewingPersonLabel } from "./ViewingPersonLabel";

const TABS = [
  { id: "week", hint: "Schedule" },
  { id: "events", hint: "Events" },
  { id: "more", hint: "Settings" },
] as const satisfies readonly { id: AppTabId; hint: string }[];

function dockActionKind(tab: AppTabId): "week" | "events" | "account" {
  if (tab === "events") return "events";
  if (tab === "more" || tab === "classes") return "account";
  return "week";
}

export function MobileTabBar({
  tab,
  onTabChange,
  hidden = false,
  viewingName = null,
  onBackFromViewing,
  expanded = false,
  onExpand,
  onCollapse,
  actionLabel,
  signedIn = false,
  actionPanel,
}: {
  tab: AppTabId;
  onTabChange: (tab: AppTabId) => void;
  hidden?: boolean;
  viewingName?: string | null;
  onBackFromViewing?: () => void;
  expanded?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  actionLabel: string;
  signedIn?: boolean;
  actionPanel: ReactNode;
}) {
  const highlighted = tab === "classes" ? "more" : tab;
  const selectedIndex = TABS.findIndex((item) => item.id === highlighted);
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const actionKind = dockActionKind(tab);
  const open = expanded && !hidden;
  const tween = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.45, bounce: 0.12 };

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCollapse();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onCollapse]);

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            key="dock-backdrop"
            type="button"
            className="mobile-tab-bar-backdrop"
            aria-label="Dismiss"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={onCollapse}
          />
        ) : null}
      </AnimatePresence>
      <nav
        className={`mobile-tab-bar${hidden ? " mobile-tab-bar-hidden" : ""}${open ? " mobile-tab-bar-open" : ""}`}
        aria-label="Main"
        aria-hidden={hidden}
        inert={hidden || undefined}
      >
        <AnimatePresence initial={false}>
          {open ? null : (
            <motion.div
              key="tab-pill"
              className={`mobile-tab-bar-glass${viewingName ? " mobile-tab-bar-glass-with-viewer" : ""}`}
              initial={false}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: reduceMotion ? 0 : 0.16 }}
            >
              {viewingName && onBackFromViewing ? (
                <ViewingPersonLabel
                  name={viewingName}
                  onBack={onBackFromViewing}
                />
              ) : null}
              <div
                role="tablist"
                aria-label="Views"
                className="mobile-tab-bar-items"
              >
                {selectedIndex >= 0 ? (
                  <span
                    className="mobile-tab-bar-indicator"
                    style={{ transform: `translateX(${selectedIndex * 100}%)` }}
                    aria-hidden
                  />
                ) : null}
                {TABS.map((item) => {
                  const selected = item.id === highlighted;
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
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          className={`mobile-tab-bar-action${open ? " mobile-tab-bar-action-open" : ""}`}
          transition={tween}
          style={{ borderRadius: 28 }}
          drag={open ? "y" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.04, bottom: 0.55 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 96 || info.velocity.y > 700) onCollapse();
          }}
          role={open ? "dialog" : undefined}
          aria-modal={open || undefined}
          aria-labelledby={open ? titleId : undefined}
        >
          <button
            type="button"
            className="mobile-tab-bar-action-hit"
            aria-label={actionLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
            tabIndex={open ? -1 : 0}
            aria-hidden={open}
            onClick={onExpand}
          >
            <ActionGlyph kind={actionKind} signedIn={signedIn} />
          </button>
          {open ? (
            <div className="mobile-tab-bar-action-body">
              <div
                className="mobile-tab-bar-action-handle"
                onPointerDown={(event) => dragControls.start(event)}
              >
                <span className="mobile-tab-bar-action-grip" aria-hidden />
              </div>
              <div className="flex items-center justify-between gap-3 px-5 pb-3">
                <h2
                  id={titleId}
                  className="text-title-md tracking-tight text-on-surface"
                >
                  {actionKind === "events"
                    ? "New event"
                    : actionKind === "account"
                      ? "Account"
                      : "Schedule"}
                </h2>
                <button
                  type="button"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  aria-label="Close"
                  onClick={onCollapse}
                >
                  <X size={18} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              <div className="sheet-scroll min-h-0 flex-1 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
                {actionPanel}
              </div>
            </div>
          ) : null}
        </motion.div>
      </nav>
    </>
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
  if (id === "more") return <Settings {...props} />;
  return <Calendar {...props} />;
}

function ActionGlyph({
  kind,
  signedIn,
}: {
  kind: "week" | "events" | "account";
  signedIn: boolean;
}) {
  const props = {
    size: 24,
    strokeWidth: 1.85,
    "aria-hidden": true as const,
  };
  if (kind === "events") return <Plus {...props} />;
  if (kind === "account") {
    return signedIn ? <UserRound {...props} /> : <LogIn {...props} />;
  }
  return <Settings2 {...props} />;
}
