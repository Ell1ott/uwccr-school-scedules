import { useEffect, useRef, type RefObject } from "react";

export function useDismissible(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  { escape = false } = {},
) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onDismissRef.current();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismissRef.current();
    }
    document.addEventListener("mousedown", onPointer);
    if (escape) document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [escape, onDismiss, ref]);
}
