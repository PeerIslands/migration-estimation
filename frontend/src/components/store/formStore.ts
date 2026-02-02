"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { AnswersState } from "@/components/utils/types";

type ShuffledMap = Record<string, string[]>; // sectionId -> questionIds order

export type FormState = {
  formId: string | null;
  answers: AnswersState;
  sectionIndex: number;
  submitted: boolean;
  shuffledOrderBySection: ShuffledMap;
};

type FormActions = {
  setAnswer: (answerKey: string, value: AnswersState[string]) => void;
  setSectionIndex: (index: number) => void;
  submit: () => void;
  reset: (
    formId?: string | null,
    shuffledOrderBySection?: ShuffledMap
  ) => void;
};

const initialState: FormState = {
  formId: null,
  answers: {},
  sectionIndex: 0,
  submitted: false,
  shuffledOrderBySection: {},
};

export const useFormStore = create<FormState & FormActions>()(
  devtools(
    (set) => ({
      ...initialState,
      setAnswer: (answerKey, value) =>
        set((state) => ({ answers: { ...state.answers, [answerKey]: value } })),
      setSectionIndex: (index) => set({ sectionIndex: index }),
      submit: () => set({ submitted: true }),
      reset: (formId, shuffledOrderBySection) =>
        set({
          formId: formId ?? null,
          answers: {},
          sectionIndex: 0,
          submitted: false,
          shuffledOrderBySection: shuffledOrderBySection ?? {},
        }),
    }),
    { name: "formStore" }
  )
);


