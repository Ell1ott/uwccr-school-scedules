import { DoorOpen, MessageSquare, Shuffle } from "lucide-react";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/classDetail";
import { MobileHubButton } from "./MobileHub";
import { PalettePicker } from "./PalettePicker";

export function MorePage({
  hubOpen,
  onOpenHub,
  onOpenLogin,
  onOpenFeedback,
  onOpenGate,
  onOpenAdmin,
  onOpenTryClasses,
}: {
  hubOpen?: boolean;
  onOpenHub?: () => void;
  onOpenLogin?: () => void;
  onOpenFeedback?: () => void;
  onOpenGate?: () => void;
  onOpenAdmin?: () => void;
  onOpenTryClasses: () => void;
}) {
  const auth = useAuth();
  const signedIn = Boolean(auth.displayName);
  const email = auth.session?.user.email ?? null;
  const roleLabel =
    auth.role === "staff" ? "Staff" : auth.role === "student" ? "Student" : null;

  return (
    <div className="flex min-h-dvh flex-col md:min-h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))]">
      <div className="sticky top-0 z-40 bg-surface-container-lowest/80 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-md md:static md:bg-transparent md:px-container-padding-desktop md:pt-8 md:shadow-none md:backdrop-blur-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
              Account
            </p>
            <h1 className="text-headline-lg-mobile tracking-tight">More</h1>
          </div>
          {onOpenHub ? (
            <MobileHubButton
              className="md:hidden"
              expanded={hubOpen}
              onClick={onOpenHub}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-container-padding-mobile pb-mobile-nav md:px-container-padding-desktop md:pb-24">
        <section className="overflow-hidden rounded-[18px] bg-surface-container-low">
          <div className="flex items-center gap-3 px-3 py-3">
            <span
              className={`flex size-12 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tracking-wide ${
                signedIn
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {signedIn && auth.displayName ? initials(auth.displayName) : "?"}
            </span>
            <span className="min-w-0 flex-1">
              {signedIn ? (
                <>
                  <span className="block truncate text-body-md font-medium text-on-surface">
                    {auth.displayName}
                  </span>
                  <span className="block truncate text-label-sm tracking-wide text-on-surface-variant">
                    {[roleLabel, email].filter(Boolean).join(" · ")}
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-body-md font-medium text-on-surface">
                    Not signed in
                  </span>
                  <span className="block text-label-sm tracking-wide text-on-surface-variant">
                    Log in to see your account
                  </span>
                </>
              )}
            </span>
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] bg-surface-container-low">
          <button
            type="button"
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20"
            onClick={onOpenTryClasses}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-surface-container text-on-surface">
              <Shuffle size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <span>
              <span className="block text-body-md font-medium text-on-surface">
                Try classes
              </span>
              <span className="block text-label-sm tracking-wide text-on-surface-variant">
                Preview a schedule
              </span>
            </span>
          </button>
        </section>

        <section className="overflow-hidden rounded-[18px] bg-surface-container-low px-3 py-3">
          <PalettePicker alwaysExpanded className="w-full" />
        </section>

        <section className="flex flex-col gap-2">
          {onOpenFeedback ? (
            <button
              type="button"
              className="flex h-12 items-center gap-2 rounded-[18px] bg-surface-container-low px-4 text-left text-label-sm tracking-wide text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={onOpenFeedback}
            >
              <MessageSquare size={16} strokeWidth={1.75} aria-hidden />
              Send feedback
            </button>
          ) : null}
          {auth.role === "staff" && onOpenGate ? (
            <button
              type="button"
              className="flex h-12 items-center gap-2 rounded-[18px] bg-surface-container-low px-4 text-left text-label-sm tracking-wide text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={onOpenGate}
            >
              <DoorOpen size={16} strokeWidth={1.75} aria-hidden />
              Gate
            </button>
          ) : null}
          {signedIn ? (
            <button
              type="button"
              className="flex h-12 items-center rounded-[18px] bg-surface-container-low px-4 text-left text-label-sm tracking-wide text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={() => void auth.signOut()}
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              className="flex h-12 items-center rounded-[18px] bg-surface-container-low px-4 text-left text-label-sm tracking-wide text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={() => onOpenLogin?.()}
            >
              Log in
            </button>
          )}
          {import.meta.env.VITE_SHOW_SEND_LOGINS && onOpenAdmin ? (
            <button
              type="button"
              className="flex h-12 items-center rounded-[18px] px-4 text-left text-label-sm tracking-wide text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={onOpenAdmin}
            >
              Send logins
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
