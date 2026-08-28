import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function StaffPage({
  title,
  onBack,
  children,
  mainClassName,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <header className="flex items-center gap-3 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 md:px-container-padding-desktop">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          aria-label="Back to schedules"
          onClick={onBack}
        >
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <div>
          <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            Staff
          </p>
          <h1 className="text-title-md tracking-tight">{title}</h1>
        </div>
      </header>
      <main
        className={
          mainClassName ??
          "mx-auto w-full max-w-md flex-1 px-container-padding-mobile pb-safe md:px-0"
        }
      >
        {children}
      </main>
    </div>
  );
}
