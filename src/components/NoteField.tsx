import { useEffect, useRef } from "react";

const MIN_ROWS = 3;

export function NoteField({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={MIN_ROWS}
      className="mt-1 block w-full resize-none overflow-hidden rounded-xl bg-surface-container-lowest px-3 py-2 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50"
    />
  );
}
