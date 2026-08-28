type FloatingTabOption<T extends string> = {
  id: T;
  label: string;
};

export function FloatingTabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  itemRole = "radio",
}: {
  value: T | null;
  options: readonly FloatingTabOption<T>[];
  onChange: (id: T) => void;
  ariaLabel: string;
  itemRole?: "radio" | "tab";
}) {
  const groupRole = itemRole === "tab" ? "tablist" : "radiogroup";

  return (
    <div role={groupRole} aria-label={ariaLabel} className="floating-tabs">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role={itemRole}
            className="floating-tab text-label-sm tracking-wide"
            aria-checked={itemRole === "radio" ? selected : undefined}
            aria-selected={itemRole === "tab" ? selected : undefined}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
