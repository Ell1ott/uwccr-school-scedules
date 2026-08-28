import { useEffect, useRef } from "react";
import { useEscape } from "./useEscape";

export function useOverlayLock(onClose: () => void) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEscape(onClose);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  return closeRef;
}
