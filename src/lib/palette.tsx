import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_PALETTE, type PaletteId } from "./tones";

type PaletteContextValue = {
  palette: PaletteId;
  setPalette: (id: PaletteId) => void;
  showLessonIcons: boolean;
  setShowLessonIcons: (on: boolean) => void;
};

const PaletteContext = createContext<PaletteContextValue>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
  showLessonIcons: false,
  setShowLessonIcons: () => {},
});

export function PaletteProvider({
  palette,
  setPalette,
  showLessonIcons,
  setShowLessonIcons,
  children,
}: PaletteContextValue & { children: ReactNode }) {
  return (
    <PaletteContext.Provider
      value={{ palette, setPalette, showLessonIcons, setShowLessonIcons }}
    >
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette(): PaletteContextValue {
  return useContext(PaletteContext);
}
