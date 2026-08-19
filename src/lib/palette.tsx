import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_PALETTE, type PaletteId } from "./tones";

type PaletteContextValue = {
  palette: PaletteId;
  setPalette: (id: PaletteId) => void;
};

const PaletteContext = createContext<PaletteContextValue>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
});

export function PaletteProvider({
  palette,
  setPalette,
  children,
}: PaletteContextValue & { children: ReactNode }) {
  return (
    <PaletteContext.Provider value={{ palette, setPalette }}>
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette(): PaletteContextValue {
  return useContext(PaletteContext);
}
