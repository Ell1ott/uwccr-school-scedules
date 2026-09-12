import { Eye, X } from "lucide-react";

export function ViewingPersonLabel({
  name,
  onBack,
}: {
  name: string;
  onBack: () => void;
}) {
  return (
    <div
      className="viewing-person"
      role="status"
      aria-label={`Viewing ${name}'s schedule`}
    >
      <Eye size={16} strokeWidth={1.75} className="opacity-40" aria-hidden />
      <span>{name}</span>
      <button
        type="button"
        className="viewing-person-close"
        aria-label="Back to your schedule"
        onClick={onBack}
      >
        <X size={15} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
