import { initials } from "../lib/classDetail";
import { useAuth } from "../lib/auth";
import { LoginForm } from "./LoginForm";

export function AccountActionPanel({ onAdmin }: { onAdmin?: () => void }) {
  const auth = useAuth();
  const signedIn = Boolean(auth.displayName);
  const email = auth.session?.user.email ?? null;
  const roleLabel =
    auth.role === "staff" ? "Staff" : auth.role === "student" ? "Student" : null;

  if (!signedIn) {
    return <LoginForm compact onAdmin={onAdmin} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="overflow-hidden rounded-[18px] bg-surface-container-low">
        <div className="flex items-center gap-3 px-3 py-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-[13px] font-semibold tracking-wide text-on-secondary-container">
            {auth.displayName ? initials(auth.displayName) : "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-md font-medium text-on-surface">
              {auth.displayName}
            </span>
            <span className="block truncate text-label-sm tracking-wide text-on-surface-variant">
              {[roleLabel, email].filter(Boolean).join(" · ")}
            </span>
          </span>
        </div>
      </section>
      <button
        type="button"
        className="flex h-12 items-center justify-center rounded-[18px] bg-surface-container-low px-4 text-label-sm tracking-wide text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        onClick={() => void auth.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
