import { create } from "zustand";
import type {
  PersonalContact,
  PersonalExpense,
} from "@/services/personalLedgerService";

interface PersonalStore {
  contacts: PersonalContact[];
  isLoadingContacts: boolean;

  currentContact: PersonalContact | null;
  currentExpenses: PersonalExpense[];
  isLoadingExpenses: boolean;

  setContacts: (contacts: PersonalContact[]) => void;
  setIsLoadingContacts: (loading: boolean) => void;

  setCurrentContact: (contact: PersonalContact | null) => void;
  setCurrentExpenses: (expenses: PersonalExpense[]) => void;
  setIsLoadingExpenses: (loading: boolean) => void;

  clearCurrentContact: () => void;
}

export const usePersonalStore = create<PersonalStore>((set) => ({
  contacts: [],
  isLoadingContacts: false,

  currentContact: null,
  currentExpenses: [],
  isLoadingExpenses: false,

  setContacts: (contacts) => set({ contacts }),
  setIsLoadingContacts: (loading) => set({ isLoadingContacts: loading }),

  setCurrentContact: (contact) => set({ currentContact: contact }),
  setCurrentExpenses: (expenses) => set({ currentExpenses: expenses }),
  setIsLoadingExpenses: (loading) => set({ isLoadingExpenses: loading }),

  clearCurrentContact: () =>
    set({
      currentContact: null,
      currentExpenses: [],
      isLoadingExpenses: false,
    }),
}));
