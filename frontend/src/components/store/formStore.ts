"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  AnswersState,
  AnswerValue,
  Environment,
  GlobalAnswers,
  MigrationEstimateRequest,
  MigrationEstimateResponse,
  EnvironmentAnswers,
} from "@/components/utils/types";

type ShuffledMap = Record<string, string[]>; // sectionId -> questionIds order

export type FormState = {
  formId: string | null;
  answers: AnswersState;
  sectionIndex: number;
  submitted: boolean;
  shuffledOrderBySection: ShuffledMap;
  isSubmitting: boolean;
  estimationResult: MigrationEstimateResponse | null;
  submissionError: string | null;
};

type FormActions = {
  setAnswer: (answerKey: string, value: AnswerValue) => void;
  setSectionIndex: (index: number) => void;
  submit: () => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
  setEstimationResult: (result: MigrationEstimateResponse | null) => void;
  setSubmissionError: (error: string | null) => void;
  reset: (
    formId?: string | null,
    shuffledOrderBySection?: ShuffledMap
  ) => void;
  /**
   * Build the API request payload from the current form state.
   * Converts yes/no string values to boolean where needed.
   * 
   * Answer key format for per-environment questions: {answerKey}_env_{index}
   * Example: total_data_gb_env_0, hard_deletes_env_1
   * 
   * Environment names are stored as: env_name_{index}
   * Example: env_name_0, env_name_1
   */
  buildEstimateRequest: () => MigrationEstimateRequest;
};

const initialState: FormState = {
  formId: null,
  answers: {},
  sectionIndex: 0,
  submitted: false,
  shuffledOrderBySection: {},
  isSubmitting: false,
  estimationResult: null,
  submissionError: null,
};

/**
 * Helper to convert "yes"/"no" string to boolean.
 */
const yesNoToBoolean = (value: AnswerValue): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "yes";
  return false;
};

/**
 * Helper to safely get a number value.
 */
const toNumber = (value: AnswerValue, defaultValue: number = 0): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

/**
 * Helper to get a string value.
 */
const toString = (value: AnswerValue): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
};

export const useFormStore = create<FormState & FormActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setAnswer: (answerKey, value) =>
        set((state) => ({ answers: { ...state.answers, [answerKey]: value } })),

      setSectionIndex: (index) => set({ sectionIndex: index }),

      submit: () => set({ submitted: true }),

      setIsSubmitting: (isSubmitting) => set({ isSubmitting }),

      setEstimationResult: (result) => set({ estimationResult: result }),

      setSubmissionError: (error) => set({ submissionError: error }),

      reset: (formId, shuffledOrderBySection) =>
        set({
          formId: formId ?? null,
          answers: {},
          sectionIndex: 0,
          submitted: false,
          shuffledOrderBySection: shuffledOrderBySection ?? {},
          isSubmitting: false,
          estimationResult: null,
          submissionError: null,
        }),

      buildEstimateRequest: (): MigrationEstimateRequest => {
        const state = get();
        const { answers } = state;

        // Get number of environments from answers
        const numEnvironments = toNumber(answers.number_of_environments, 0);

        // Build environments array from form answers
        // Environment names are stored as env_name_0, env_name_1, etc.
        // Per-env answers are stored as {answerKey}_env_{index} (e.g., total_data_gb_env_0)
        const environments: Environment[] = [];
        
        for (let index = 0; index < numEnvironments; index++) {
          // Get environment name from answers
          const envName = toString(answers[`env_name_${index}`]) || `Environment ${index + 1}`;
          
          // Helper to get per-environment answer using the format: {answerKey}_env_{index}
          const getEnvAnswer = (key: string): AnswerValue => answers[`${key}_env_${index}`];

          const envAnswers: EnvironmentAnswers = {
            // Required fields
            total_data_gb: toNumber(getEnvAnswer("total_data_gb"), 0),
            number_of_collections: toNumber(getEnvAnswer("number_of_collections"), 0),
            number_of_databases: toNumber(getEnvAnswer("number_of_databases"), 0),
            reverse_sync: yesNoToBoolean(getEnvAnswer("reverse_sync")),
            hard_deletes: yesNoToBoolean(getEnvAnswer("hard_deletes")),

            // Optional fields
            api_version: toString(getEnvAnswer("api_version")),
            num_accounts: toNumber(getEnvAnswer("num_accounts")),
            has_partitioned_collections: yesNoToBoolean(getEnvAnswer("has_partitioned_collections")),
            ru_configuration: toString(getEnvAnswer("ru_configuration")),
            read_write_tps: toString(getEnvAnswer("read_write_tps")),
            num_consumer_apps: toNumber(getEnvAnswer("num_consumer_apps")),
            performs_deletes: yesNoToBoolean(getEnvAnswer("performs_deletes")),
            change_stream_required: yesNoToBoolean(getEnvAnswer("change_stream_required")),
            app_refactoring_required: yesNoToBoolean(getEnvAnswer("app_refactoring_required")),
            app_refactoring_details: toString(getEnvAnswer("app_refactoring_details")),
            maintenance_window: toString(getEnvAnswer("maintenance_window")),
          };

          environments.push({
            environment_name: envName,
            answers: envAnswers,
          });
        }

        // Build global answers (common questions, not per-environment)
        const globalAnswers: GlobalAnswers = {
          source_api: (toString(answers.source_api) as GlobalAnswers["source_api"]) || "mongo",
          target_cloud: (toString(answers.target_cloud) as GlobalAnswers["target_cloud"]) || "aws",

          // Optional global fields
          programming_lang_driver_version: toString(answers.programming_lang_driver_version),
          vpn_vpc_required: yesNoToBoolean(answers.vpn_vpc_required),
          is_data_transformation_required: yesNoToBoolean(answers.is_data_transformation_required),
          data_transformation_details: toString(answers.data_transformation_details),
        };

        return {
          migration_type: "cosmosdb_to_mongodb",
          questionnaire_version: "v1",
          number_of_environments: numEnvironments,
          environments,
          global_answers: globalAnswers,
        };
      },
    }),
    { name: "formStore" }
  )
);


