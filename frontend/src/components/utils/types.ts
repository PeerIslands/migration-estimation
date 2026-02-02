export type ValidationRule = {
  type?: "string" | "number" | "email" | "regex";
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

export type UIProps = {
  orientation?: "vertical" | "horizontal";
  rows?: number;
};

export type QuestionOption = {
  value: string;
  label?: string;
};

/** "common" = asked once; "perEnv" = repeated per environment */
export type QuestionScope = "common" | "perEnv";

export type Question = {
  questionId: string;
  /** If "perEnv", question is repeated once per environment with env-specific answerKey */
  scope?: QuestionScope;
  questionType:
    | "text"
    | "email"
    | "number"
    | "date"
    | "mcq"
    | "checkbox"
    | "rating"
    | "textarea";
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  answerKey: string;
  validation?: ValidationRule;
  options?: QuestionOption[];
  uiProps?: UIProps;
  min?: number; // for number and rating
  max?: number; // for number and rating
};

export type Section = {
  sectionId: string;
  title: string;
  description?: string;
  questions: Question[];
  /** When set, section is shown as tabs (one tab per env); each tab shows that env's questions. Used for per-env sections. */
  questionsByEnv?: Question[][];
};

export type Settings = {
  shuffleQuestions?: boolean;
  progressBar?: boolean;
  submitButtonText?: string;
  thankYouMessage?: string;
  allowSaveAndResume?: boolean;
};

export type FormConfig = {
  formId: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sections: Section[];
  settings?: Settings;
};

export type AnswerValue = string | number | string[] | undefined;
export type AnswersState = Record<string, AnswerValue>; // answerKey -> value

export type SavedState = {
  answers: AnswersState;
  sectionIndex: number;
  shuffledOrderBySection: Record<string, string[]>; // sectionId -> questionIds order
  submitted?: boolean;
};


