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

export type AnswerValue = string | number | boolean | string[] | undefined;
export type AnswersState = Record<string, AnswerValue>; // answerKey -> value

export type SavedState = {
  answers: AnswersState;
  sectionIndex: number;
  shuffledOrderBySection: Record<string, string[]>; // sectionId -> questionIds order
  submitted?: boolean;
};

// ============================================
// API Request Payload Types (for /estimate endpoint)
// ============================================

/**
 * Per-environment answers from the questionnaire.
 * Yes/No values from form are converted to boolean.
 */
export type EnvironmentAnswers = {
  // Required for estimation calculation
  total_data_gb: number;
  number_of_collections: number;
  number_of_databases: number;
  reverse_sync: boolean;
  hard_deletes: boolean;
  
  // Optional fields
  api_version?: string;
  num_accounts?: number;
  has_partitioned_collections?: boolean;
  ru_configuration?: string;
  read_write_tps?: string;
  num_consumer_apps?: number;
  performs_deletes?: boolean;
  change_stream_required?: boolean;
  app_refactoring_required?: boolean;
  app_refactoring_details?: string;
  maintenance_window?: string;
};

/**
 * Environment configuration with name and answers.
 */
export type Environment = {
  environment_name: string;
  answers: EnvironmentAnswers;
};

/**
 * Global/common answers that apply to all environments.
 */
export type GlobalAnswers = {
  source_api: "mongo" | "sql" | "nosql";
  target_cloud: "aws" | "azure" | "google";
  
  // Optional global fields
  programming_lang_driver_version?: string;
  vpn_vpc_required?: boolean;
  is_data_transformation_required?: boolean;
  data_transformation_details?: string;
};

/**
 * Migration estimate request payload structure.
 */
export type MigrationEstimateRequest = {
  migration_type: "cosmosdb_to_mongodb";
  questionnaire_version: string;
  number_of_environments: number;
  environments: Environment[];
  global_answers: GlobalAnswers;
};

// ============================================
// API Response Types (from /estimate endpoint)
// ============================================

/**
 * Activity breakdown for a specific environment.
 */
export type EnvironmentActivityBreakdown = {
  activity: string;
  description: string;
  effort_days?: number; // Optional - may not be provided by backend
  effort_hours?: number; // Optional - may not be provided by backend
};

/**
 * Complete estimation for a single environment including activities.
 */
export type PerEnvironmentEstimate = {
  environment_name: string;
  
  // Migration effort from rules
  data_tier: string;
  base_days: number;
  collection_adjustment_days: number;
  migration_days: number;
  migration_hours: number;
  
  // Per-environment activities
  activities: EnvironmentActivityBreakdown[];
  activities_days?: number; // Optional - may not be provided by backend
  activities_hours?: number; // Optional - may not be provided by backend
  
  // Environment totals
  total_days: number;
  total_hours: number;
  
  // Variance for this environment
  total_days_low: number;
  total_days_high: number;
  
  notes: string[];
};

/**
 * Activities shared across all environments (one-time costs).
 */
export type SharedActivityBreakdown = {
  activity: string;
  description: string;
  effort_days?: number; // Optional - may not be provided by backend
  effort_hours?: number; // Optional - may not be provided by backend
  note: string;
};

/**
 * Migration estimate response from the API.
 */
export type MigrationEstimateResponse = {
  migration_type: string;
  questionnaire_version: string;
  
  // Per-environment estimates (detailed)
  per_environment_estimates: PerEnvironmentEstimate[];
  
  // Shared activities (one-time, not per environment)
  shared_activities: SharedActivityBreakdown[];
  shared_activities_days?: number; // Optional - may not be provided by backend
  shared_activities_hours?: number; // Optional - may not be provided by backend
  
  // Grand totals
  total_migration_days: number;
  total_migration_hours: number;
  
  // Variance
  estimation_variance_percent: number;
  total_days_low: number;
  total_days_high: number;
  
  // Assumptions applied
  assumptions: string[];
};


