import { useEffect, useState } from "react";
import { moderateEventByToken } from "../lib/schoolEvents";
import { StaffPage } from "./StaffPage";

function readModerateParams() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token")?.trim() ?? "";
  const raw = params.get("decision");
  const decision = raw === "allow" || raw === "deny" ? raw : null;
  return { token, decision };
}

export function ModerateEventPage({ onDone }: { onDone: () => void }) {
  const [{ token, decision }] = useState(readModerateParams);
  const invalid = !token || !decision;
  const [message, setMessage] = useState(
    invalid ? "This link is missing information." : "Working…",
  );
  const [ok, setOk] = useState<boolean | null>(invalid ? false : null);

  useEffect(() => {
    if (invalid || !decision) return;
    void moderateEventByToken(token, decision).then((result) => {
      setOk(result.ok);
      setMessage(result.message);
    });
  }, [invalid, token, decision]);

  const title =
    ok === null ? "Please wait" : ok ? "Done" : "Could not update";

  return (
    <StaffPage title={title} eyebrow="Events" onBack={onDone}>
      <div className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_8px_32px_rgba(4,22,39,0.06)]">
        <p className="text-body-md text-on-surface-variant">{message}</p>
        {ok !== null ? (
          <button
            type="button"
            className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary"
            onClick={onDone}
          >
            Back to schedules
          </button>
        ) : null}
      </div>
    </StaffPage>
  );
}
