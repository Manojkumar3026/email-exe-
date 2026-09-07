import { create } from 'zustand';

interface JobState {
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
}

export const useJobStore = create<JobState>((set) => ({
  activeJobId: null,
  setActiveJobId: (id) => set({ activeJobId: id }),
}));
