import { AnswerValue, SavedState } from "./types";

export type Action =
  | { type: "set_answer"; answerKey: string; value: AnswerValue }
  | { type: "set_section"; index: number }
  | { type: "hydrate"; payload: SavedState }
  | { type: "submit" };

export function answersReducer(state: SavedState, action: Action): SavedState {
  switch (action.type) {
    case "set_answer": {
      const updated: SavedState = {
        ...state,
        answers: { ...state.answers, [action.answerKey]: action.value },
      };
      return updated;
    }
    case "set_section": {
      return { ...state, sectionIndex: action.index };
    }
    case "hydrate": {
      return { ...state, ...action.payload };
    }
    case "submit": {
      return { ...state, submitted: true };
    }
    default:
      return state;
  }
}

export function getLocalStorageKey(formId: string): string {
  return `formResponses:${formId}`;
}


