import { Bug, Check, Lightbulb, MessageSquare, X, type LucideIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { track } from "../lib/analytics";
import { sendFeedback, type FeedbackKind } from "../lib/feedback";
import { BottomSheet, SheetHandle } from "./BottomSheet";

const KIND_CARDS: {
  id: FeedbackKind;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { id: "bug", label: "Bug", hint: "Something's broken", icon: Bug },
  {
    id: "feature",
    label: "Feature",
    hint: "An idea for the app",
    icon: Lightbulb,
  },
  {
    id: "general",
    label: "General",
    hint: "Anything else",
    icon: MessageSquare,
  },
];

export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const [kind, setKind] = useState<FeedbackKind>("general");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < 8) {
      setError("Write a little more so I know what you mean.");
      return;
    }
    setBusy(true);
    track("feedback_submitted", { kind });
    const failed = await sendFeedback(kind, trimmed);
    setBusy(false);
    if (failed) {
      track("feedback_failed", { kind, error: failed });
      setError(failed);
      return;
    }
    setSent(true);
  }

  return (
    <BottomSheet
      labelledBy={titleId}
      overlayLabel="Close feedback"
      onClose={onClose}
      className="md:items-center md:p-6"
      panelClassName="max-w-lg md:max-h-[min(40rem,85vh)] md:rounded-[28px]"
    >
      {(closeRef) => (
        <>
          <div className="px-5 pt-2 pb-4 md:pt-5">
            <SheetHandle />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id={titleId} className="text-title-md tracking-tight">
                  {sent ? "Got it" : "Send feedback"}
                </h2>
                <p className="mt-0.5 text-label-sm text-on-surface-variant">
                  {sent
                    ? "Thanks — I’ll read it."
                    : "Bugs, ideas, or anything else."}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label="Close feedback"
                onClick={onClose}
              >
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col items-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface">
                <Check size={22} strokeWidth={1.75} aria-hidden />
              </span>
              <button
                type="button"
                className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          ) : (
            <form
              className="sheet-scroll flex flex-col gap-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
              onSubmit={(event) => void onSubmit(event)}
            >
              <div>
                <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                  What is it
                </p>
                <div
                  role="radiogroup"
                  aria-label="Feedback type"
                  className="mt-2 grid grid-cols-3 gap-2"
                >
                  {KIND_CARDS.map((item) => {
                    const selected = kind === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`flex flex-col items-start gap-3 rounded-[18px] px-3 py-3 text-left transition-[filter,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                          selected
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container text-on-surface hover:brightness-[0.97]"
                        }`}
                        onClick={() => setKind(item.id)}
                      >
                        <span
                          className={`flex size-9 items-center justify-center rounded-full ${
                            selected
                              ? "bg-white/15 text-on-primary"
                              : "bg-surface-container-lowest text-on-surface"
                          }`}
                        >
                          <Icon size={16} strokeWidth={1.75} aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold tracking-wide">
                            {item.label}
                          </span>
                          <span
                            className={`mt-0.5 block text-[11px] leading-4 ${
                              selected
                                ? "text-on-primary/75"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {item.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                Your note
                <textarea
                  required
                  minLength={8}
                  maxLength={4000}
                  rows={6}
                  value={message}
                  placeholder="What happened, or what you wish this did…"
                  onChange={(event) => setMessage(event.target.value)}
                  className="mt-2 w-full resize-none rounded-2xl bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none placeholder:text-on-surface-variant/70 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </label>

              {error ? <p className="text-body-md text-error">{error}</p> : null}

              <button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </>
      )}
    </BottomSheet>
  );
}
