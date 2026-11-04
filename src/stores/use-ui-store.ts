import { create } from "zustand";

interface UiState {
  aboutOpen: boolean;
  setAboutOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  aboutOpen: false,
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
}));
