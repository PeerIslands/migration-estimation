import { AnswersState, type Question, type Section } from "./types";

export function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SETUP_SECTION_ID = "setup";
const NAME_ENVIRONMENTS_SECTION_ID = "name_environments";
const PER_ENV_TABS_SECTION_ID = "per_env_tabs";
const MIN_ENV = 1;
const MAX_ENV = 20;

/** Content sections (exclude setup) that have common/perEnv questions */
function getContentSections(rawSections: Section[]): Section[] {
  return rawSections.filter((s) => s.sectionId !== SETUP_SECTION_ID);
}

/** Build questions for "Name your environments": one text input per environment */
function buildNameEnvironmentsQuestions(numEnv: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < numEnv; i++) {
    out.push({
      questionId: `env_name_${i}`,
      answerKey: `env_name_${i}`,
      questionType: "text",
      label: `Name for environment ${i + 1}`,
      placeholder: `e.g. Dev, QA, Prod`,
      validation: { type: "string" },
      required: true,
    });
  }
  return out;
}

/** Per-env question for one environment (original label, no "Environment N:" prefix) */
function expandQuestionForEnv(q: Question, envIndex: number): Question {
  return {
    ...q,
    questionId: `${q.questionId}_env_${envIndex}`,
    answerKey: `${q.answerKey}_env_${envIndex}`,
    label: q.label,
  };
}

/** Collect all per-env questions from content sections, grouped by env index. */
function buildQuestionsByEnv(contentSections: Section[], numEnv: number): Question[][] {
  const questionsByEnv: Question[][] = Array.from({ length: numEnv }, () => []);
  for (const sec of contentSections) {
    for (const q of sec.questions) {
      const scope = q.scope ?? "common";
      if (scope !== "perEnv") continue;
      for (let i = 0; i < numEnv; i++) {
        questionsByEnv[i].push(expandQuestionForEnv(q, i));
      }
    }
  }
  return questionsByEnv;
}

/** Collect all common questions from content sections in order. */
function buildCommonQuestions(contentSections: Section[]): Question[] {
  const out: Question[] = [];
  for (const sec of contentSections) {
    for (const q of sec.questions) {
      const scope = q.scope ?? "common";
      if (scope === "common") out.push({ ...q });
    }
  }
  return out;
}

/**
 * Build the effective sections:
 * - numEnvironments 0: only setup (How many environments?).
 * - numEnvironments >= 1: setup → name_environments (N name inputs) → per_env_tabs (tabbed) → common → submit.
 */
export function buildEffectiveSections(
  rawSections: Section[],
  numEnvironments: number
): Section[] {
  const setupSection = rawSections.find((s) => s.sectionId === SETUP_SECTION_ID);
  const contentSections = getContentSections(rawSections);

  const numEnv =
    typeof numEnvironments === "number" &&
    numEnvironments >= MIN_ENV &&
    numEnvironments <= MAX_ENV
      ? numEnvironments
      : 0;

  if (numEnv === 0) {
    return setupSection ? [setupSection] : [];
  }

  const nameEnvironmentsSection: Section = {
    sectionId: NAME_ENVIRONMENTS_SECTION_ID,
    title: "Name your environments",
    description: "Give each environment a name (e.g. Dev, QA, Prod).",
    questions: buildNameEnvironmentsQuestions(numEnv),
  };

  const questionsByEnv = buildQuestionsByEnv(contentSections, numEnv);
  const perEnvTabsSection: Section = {
    sectionId: PER_ENV_TABS_SECTION_ID,
    title: "Environment details",
    description: "Fill in the details for each environment. Use the tabs to switch between environments.",
    questions: [],
    questionsByEnv,
  };

  const commonSection: Section = {
    sectionId: "common",
    title: "Common Configuration",
    description: "These apply to all environments.",
    questions: buildCommonQuestions(contentSections),
  };

  return [
    ...(setupSection ? [setupSection] : []),
    nameEnvironmentsSection,
    perEnvTabsSection,
    commonSection,
  ];
}

/** Get flat list of questions for a section (either questions or questionsByEnv.flat()) */
function getSectionQuestions(section: Section): Question[] {
  if (section.questionsByEnv && section.questionsByEnv.length > 0) {
    return section.questionsByEnv.flat();
  }
  return section.questions;
}

export function countTotalQuestions(sections: Section[]): number {
  return sections.reduce((sum, s) => sum + getSectionQuestions(s).length, 0);
}

export function countAnsweredQuestions(sections: Section[], answers: AnswersState): number {
  let count = 0;
  for (const section of sections) {
    for (const q of getSectionQuestions(section)) {
      const v = answers[q.answerKey];
      const isAnswered =
        v !== undefined &&
        v !== null &&
        (typeof v !== "string" || v.trim() !== "") &&
        (!Array.isArray(v) || v.length > 0);
      if (isAnswered) count += 1;
    }
  }
  return count;
}

/** Count only questions marked as required. */
export function countRequiredQuestions(sections: Section[]): number {
  let count = 0;
  for (const section of sections) {
    for (const q of getSectionQuestions(section)) {
      if (q.required) count += 1;
    }
  }
  return count;
}

/** Count how many required questions have been answered. */
export function countAnsweredRequiredQuestions(sections: Section[], answers: AnswersState): number {
  let count = 0;
  for (const section of sections) {
    for (const q of getSectionQuestions(section)) {
      if (!q.required) continue;
      const v = answers[q.answerKey];
      const isAnswered =
        v !== undefined &&
        v !== null &&
        (typeof v !== "string" || v.trim() !== "") &&
        (!Array.isArray(v) || v.length > 0);
      if (isAnswered) count += 1;
    }
  }
  return count;
}

export const PER_ENV_TABS_SECTION_ID_EXPORT = PER_ENV_TABS_SECTION_ID;


