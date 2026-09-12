import { Eye, X } from "lucide-react";

export function ViewingPersonLabel({
  name,
  hidden = false,
  onBack,
}: {
  name: string;
  hidden?: boolean;
  onBack: () => void;
}) {
  return (
    <div
      className={`viewing-person ${hidden ? "viewing-person-hidden" : ""}`}
      role="status"
      aria-label={`Viewing ${name}'s schedule`}
      aria-hidden={hidden}
      inert={hidden || undefined}
    >
      <div className="viewing-person-glass">
        <Eye
          size={18}
          strokeWidth={1.75}
          className="opacity-35"
          aria-hidden
        />
        <span>{name}</span>
        <button
          type="button"
          className="viewing-person-close"
          aria-label="Back to your schedule"
          onClick={onBack}
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}
