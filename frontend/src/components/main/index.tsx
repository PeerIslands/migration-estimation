"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./index.module.css";
import {
  type FormConfig,
  type Question,
  type Section,
  type AnswerValue,
} from "@/components/utils/types";
import { validateAnswer } from "@/components/utils/validation";
import {
  buildEffectiveSections,
  countAnsweredQuestions,
  countTotalQuestions,
  shuffleArray,
  PER_ENV_TABS_SECTION_ID_EXPORT as PER_ENV_TABS_SECTION_ID,
} from "@/components/utils/helpers";
import { useFormStore } from "@/components/store/formStore";
import { submitEstimation, saveEstimation } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import EstimationResults from "@/components/results/EstimationResults";
import AIAutofillChatbot from "@/components/ai-autofill/AIAutofillChatbot";

type FormRendererProps = { config: FormConfig };

export default function FormRenderer({ config }: FormRendererProps) {
  const { formId, title, description, sections: rawSections, settings } = config;

  // Track an active form id that can be incremented after submit
  const [activeFormId, setActiveFormId] = useState(formId);

  const shuffleQuestions = settings?.shuffleQuestions ?? false;
  const showProgress = settings?.progressBar ?? false;
  const submitText = settings?.submitButtonText ?? "Submit";
  const thankYouMessage = settings?.thankYouMessage ?? "Thank you!";
  const allowSaveAndResume = settings?.allowSaveAndResume ?? false;

  const {
    formId: storeFormId,
    answers,
    sectionIndex,
    submitted,
    shuffledOrderBySection: storedOrder,
    isSubmitting,
    estimationResult,
    submissionError,
    setAnswer,
    setSectionIndex,
    submit,
    setIsSubmitting,
    setEstimationResult,
    setSubmissionError,
    reset,
    buildEstimateRequest,
  } = useFormStore();

  const [errorsByQuestionId, setErrorsByQuestionId] = useState<Record<string, string>>({});
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isChatbotCollapsed, setIsChatbotCollapsed] = useState(false);

  const numEnvironments = Number(answers.number_of_environments) || 0;

  // Build effective sections: setup first, then common + per-env questions based on num_environments
  const sections: Section[] = useMemo(() => {
    const effective = buildEffectiveSections(rawSections, numEnvironments);
    const cloned = effective.map((s) => ({ ...s, questions: [...s.questions] }));
    for (const section of cloned) {
      const existing = storedOrder[section.sectionId];
      if (existing && existing.length === section.questions.length) {
        section.questions.sort(
          (a, b) => existing.indexOf(a.questionId) - existing.indexOf(b.questionId)
        );
      }
    }
    return cloned;
  }, [rawSections, numEnvironments, storedOrder]);

  // Clamp section index when sections shrink (e.g. user goes back and reduces number of environments)
  useEffect(() => {
    if (sectionIndex >= sections.length && sections.length > 0) {
      setSectionIndex(sections.length - 1);
    }
  }, [sections.length, sectionIndex, setSectionIndex]);

  // Reset active tab when entering the per-env tabs section
  useEffect(() => {
    const current = sections[sectionIndex];
    if (current?.sectionId === PER_ENV_TABS_SECTION_ID) {
      setActiveTabIndex(0);
    }
  }, [sectionIndex, sections]);

  // On first load or when form changes, initialize order in the store (using raw sections for initial order)
  useEffect(() => {
    if (storeFormId === activeFormId && Object.keys(storedOrder).length > 0) return;

    const order: Record<string, string[]> = {};
    for (const s of rawSections) {
      const qs = shuffleQuestions ? shuffleArray([...s.questions]) : [...s.questions];
      order[s.sectionId] = qs.map((q) => q.questionId);
    }
    reset(activeFormId, order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFormId, rawSections, shuffleQuestions]);

  const totalQuestions = useMemo(() => countTotalQuestions(sections), [sections]);
  const answeredCount = useMemo(() => countAnsweredQuestions(sections, answers), [sections, answers]);
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  function handleInputChange(question: Question, value: AnswerValue) {
    setAnswer(question.answerKey, value as any);
  }

  function handleBlur(question: Question) {
    const value = answers[question.answerKey];
    const error = validateAnswer(question, value);
    setErrorsByQuestionId((prev) => ({ ...prev, [question.questionId]: error || "" }));
  }

  function getSectionQuestionsForValidation(section: Section): Question[] {
    if (section.questionsByEnv && section.questionsByEnv.length > 0) {
      return section.questionsByEnv.flat();
    }
    return section.questions;
  }

  function validateSection(section: Section): { valid: boolean; errorQuestionIds: string[] } {
    const questionsToValidate = getSectionQuestionsForValidation(section);
    const newErrors: Record<string, string> = {};
    for (const q of questionsToValidate) {
      const value = answers[q.answerKey];
      const error = validateAnswer(q, value);
      if (error) newErrors[q.questionId] = error;
    }
    setErrorsByQuestionId((prev) => ({ ...prev, ...newErrors }));
    const errorQuestionIds = Object.keys(newErrors);
    return { valid: errorQuestionIds.length === 0, errorQuestionIds };
  }

  /** Find first tab index that has any of the given error question IDs (for tabbed per-env section). */
  function getFirstTabWithErrors(
    section: Section,
    errorQuestionIds: string[]
  ): number {
    if (!section.questionsByEnv?.length || errorQuestionIds.length === 0)
      return 0;
    const errorSet = new Set(errorQuestionIds);
    for (let i = 0; i < section.questionsByEnv.length; i++) {
      const hasError = section.questionsByEnv[i].some((q) =>
        errorSet.has(q.questionId)
      );
      if (hasError) return i;
    }
    return 0;
  }

  function goNext() {
    const current = sections[sectionIndex];
    if (!current) return;
    const { valid, errorQuestionIds } = validateSection(current);
    if (!valid) {
      // On tabbed section: switch to first incomplete environment — user must complete all envs before Common
      if (
        current.sectionId === PER_ENV_TABS_SECTION_ID &&
        current.questionsByEnv?.length
      ) {
        const firstInvalidTab = getFirstTabWithErrors(current, errorQuestionIds);
        setActiveTabIndex(firstInvalidTab);
      }
      return;
    }
    
    // Special case: on setup section, after entering numEnvironments, 
    // sections will rebuild on next render with more sections
    if (current.sectionId === "setup" && sections.length === 1) {
      // Check if numEnvironments is now set (validation passed)
      const enteredNum = Number(answers.number_of_environments) || 0;
      if (enteredNum >= 1) {
        // Move to section 1 - on re-render, sections will have more items
        setSectionIndex(1);
        return;
      }
    }
    
    if (sectionIndex < sections.length - 1) {
      setSectionIndex(sectionIndex + 1);
    }
  }

  function goBack() {
    if (sectionIndex > 0) {
      setSectionIndex(sectionIndex - 1);
    }
  }

  const { isAuthenticated } = useAuthStore();

  async function handleSubmit() {
    // validate all sections before submit (including all environment tabs)
    let valid = true;
    for (const section of sections) {
      const result = validateSection(section);
      if (!result.valid) valid = false;
    }
    if (!valid) return;

    // Build API request and submit to backend
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const request = buildEstimateRequest();
      const result = await submitEstimation(request);
      setEstimationResult(result);
      
      // Auto-save to database if user is authenticated
      if (isAuthenticated) {
        try {
          const timestamp = new Date().toLocaleString();
          await saveEstimation({
            name: `Estimation - ${timestamp}`,
            request_data: request,
            response_data: result,
          });
          console.log("Estimation saved to database");
        } catch (saveError) {
          // Don't block the UI if save fails, just log it
          console.error("Failed to save estimation:", saveError);
          // Optionally show a warning but still show results
        }
      }
      
      submit();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to submit estimation. Please try again.";
      setSubmissionError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  function incrementFormId(id: string): string {
    const digitMatches = id.match(/\d+/g);
    if (!digitMatches || digitMatches.length === 0) return `${id}_2`;
    const lastDigits = digitMatches[digitMatches.length - 1];
    const lastIndex = id.lastIndexOf(lastDigits);
    const prefix = id.slice(0, lastIndex);
    const suffix = id.slice(lastIndex + lastDigits.length);
    const nextNumber = String(parseInt(lastDigits, 10) + 1).padStart(lastDigits.length, "0");
    return `${prefix}${nextNumber}${suffix}`;
  }

  /**
   * Handle AI-extracted data and populate the form
   */
  function handleAIDataExtracted(data: any) {
    // Optionally collapse the chatbot after extraction
    // setIsChatbotCollapsed(true);
    
    // Populate global answers
    if (data.global_answers) {
      if (data.global_answers.source_api) {
        setAnswer("source_api", data.global_answers.source_api);
      }
      if (data.global_answers.target_cloud) {
        setAnswer("target_cloud", data.global_answers.target_cloud);
      }
      if (data.global_answers.programming_lang_driver_version) {
        setAnswer("programming_lang_driver_version", data.global_answers.programming_lang_driver_version);
      }
      if (data.global_answers.vpn_vpc_required !== undefined) {
        setAnswer("vpn_vpc_required", data.global_answers.vpn_vpc_required ? "yes" : "no");
      }
      if (data.global_answers.is_data_transformation_required !== undefined) {
        setAnswer("is_data_transformation_required", data.global_answers.is_data_transformation_required ? "yes" : "no");
      }
      if (data.global_answers.data_transformation_details) {
        setAnswer("data_transformation_details", data.global_answers.data_transformation_details);
      }
    }
    
    // Populate number of environments
    if (data.number_of_environments) {
      setAnswer("number_of_environments", data.number_of_environments);
    }
    
    // Populate environment-specific answers
    if (data.environments && Array.isArray(data.environments)) {
      data.environments.forEach((env: any, index: number) => {
        // Environment name
        if (env.environment_name) {
          setAnswer(`env_name_${index}`, env.environment_name);
        }
        
        // Required fields
        if (env.answers) {
          const envAnswers = env.answers;
          
          if (envAnswers.total_data_gb !== undefined) {
            setAnswer(`total_data_gb_env_${index}`, envAnswers.total_data_gb);
          }
          if (envAnswers.number_of_collections !== undefined) {
            setAnswer(`number_of_collections_env_${index}`, envAnswers.number_of_collections);
          }
          if (envAnswers.number_of_databases !== undefined) {
            setAnswer(`number_of_databases_env_${index}`, envAnswers.number_of_databases);
          }
          if (envAnswers.reverse_sync !== undefined) {
            setAnswer(`reverse_sync_env_${index}`, envAnswers.reverse_sync ? "yes" : "no");
          }
          if (envAnswers.hard_deletes !== undefined) {
            setAnswer(`hard_deletes_env_${index}`, envAnswers.hard_deletes ? "yes" : "no");
          }
          
          // Optional fields
          if (envAnswers.api_version) {
            setAnswer(`api_version_env_${index}`, envAnswers.api_version);
          }
          if (envAnswers.num_accounts !== undefined) {
            setAnswer(`num_accounts_env_${index}`, envAnswers.num_accounts);
          }
          if (envAnswers.has_partitioned_collections !== undefined) {
            setAnswer(`has_partitioned_collections_env_${index}`, envAnswers.has_partitioned_collections ? "yes" : "no");
          }
          if (envAnswers.ru_configuration) {
            setAnswer(`ru_configuration_env_${index}`, envAnswers.ru_configuration);
          }
          if (envAnswers.read_write_tps) {
            setAnswer(`read_write_tps_env_${index}`, envAnswers.read_write_tps);
          }
          if (envAnswers.num_consumer_apps !== undefined) {
            setAnswer(`num_consumer_apps_env_${index}`, envAnswers.num_consumer_apps);
          }
          if (envAnswers.performs_deletes !== undefined) {
            setAnswer(`performs_deletes_env_${index}`, envAnswers.performs_deletes ? "yes" : "no");
          }
          if (envAnswers.change_stream_required !== undefined) {
            setAnswer(`change_stream_required_env_${index}`, envAnswers.change_stream_required ? "yes" : "no");
          }
          if (envAnswers.app_refactoring_required !== undefined) {
            setAnswer(`app_refactoring_required_env_${index}`, envAnswers.app_refactoring_required ? "yes" : "no");
          }
          if (envAnswers.app_refactoring_details) {
            setAnswer(`app_refactoring_details_env_${index}`, envAnswers.app_refactoring_details);
          }
          if (envAnswers.maintenance_window) {
            setAnswer(`maintenance_window_env_${index}`, envAnswers.maintenance_window);
          }
        }
      });
    }
    
    // Move to section index 0 to show the setup section with populated data
    setSectionIndex(0);
  }

  function resetForm() {
    setErrorsByQuestionId({});
    const nextId = incrementFormId(activeFormId);
    // Retain existing question order in store
    reset(nextId, storedOrder);
    setActiveFormId(nextId);
  }

  function renderTextInput(question: Question) {
    return (
      <input
        className={styles.input}
        id={question.questionId}
        type="text"
        placeholder={question.placeholder}
        value={(answers[question.answerKey] as string) || ""}
        onChange={(e) => handleInputChange(question, e.target.value)}
        onBlur={() => handleBlur(question)}
        aria-invalid={Boolean(errorsByQuestionId[question.questionId])}
        aria-describedby={question.description ? `${question.questionId}-desc` : undefined}
      />
    );
  }

  function renderEmailInput(question: Question) {
    return (
      <input
        className={styles.input}
        id={question.questionId}
        type="email"
        placeholder={question.placeholder}
        value={(answers[question.answerKey] as string) || ""}
        onChange={(e) => handleInputChange(question, e.target.value)}
        onBlur={() => handleBlur(question)}
        aria-invalid={Boolean(errorsByQuestionId[question.questionId])}
        aria-describedby={question.description ? `${question.questionId}-desc` : undefined}
      />
    );
  }

  function renderNumberInput(question: Question) {
    const value = answers[question.answerKey];
    return (
      <input
        className={styles.input}
        id={question.questionId}
        type="number"
        placeholder={question.placeholder}
        min={question.min}
        max={question.max}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => handleInputChange(question, e.target.value === "" ? undefined : Number(e.target.value))}
        onBlur={() => handleBlur(question)}
        aria-invalid={Boolean(errorsByQuestionId[question.questionId])}
        aria-describedby={question.description ? `${question.questionId}-desc` : undefined}
      />
    );
  }

  function renderDateInput(question: Question) {
    const value = answers[question.answerKey];
    return (
      <input
        className={styles.input}
        id={question.questionId}
        type="date"
        value={(value as string) || ""}
        onChange={(e) => handleInputChange(question, e.target.value)}
        onBlur={() => handleBlur(question)}
        aria-invalid={Boolean(errorsByQuestionId[question.questionId])}
        aria-describedby={question.description ? `${question.questionId}-desc` : undefined}
      />
    );
  }

  function renderMCQ(question: Question) {
    const selected = (answers[question.answerKey] as string) || "";
    const orientation = question.uiProps?.orientation || "vertical";
    return (
      <div className={`${styles.optionGroup} ${orientation === "horizontal" ? styles.horizontal : styles.vertical}`} role="radiogroup" aria-labelledby={`${question.questionId}-label`}>
        {question.options?.map((opt) => (
          <label key={opt.value} className={styles.optionItem}>
            <input
              type="radio"
              name={question.questionId}
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => handleInputChange(question, opt.value)}
              onBlur={() => handleBlur(question)}
            />
            <span>{opt.label || opt.value}</span>
          </label>
        ))}
      </div>
    );
  }

  function renderCheckbox(question: Question) {
    const selected = (answers[question.answerKey] as string[]) || [];
    const orientation = question.uiProps?.orientation || "vertical";
    function toggle(value: string) {
      const set = new Set(selected);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      handleInputChange(question, Array.from(set));
    }
    return (
      <div className={`${styles.optionGroup} ${orientation === "horizontal" ? styles.horizontal : styles.vertical}`} role="group" aria-labelledby={`${question.questionId}-label`}>
        {question.options?.map((opt) => (
          <label key={opt.value} className={styles.optionItem}>
            <input
              type="checkbox"
              name={`${question.questionId}-${opt.value}`}
              value={opt.value}
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              onBlur={() => handleBlur(question)}
            />
            <span>{opt.label || opt.value}</span>
          </label>
        ))}
      </div>
    );
  }

  function renderRating(question: Question) {
    const min = typeof question.min === "number" ? question.min : 1;
    const max = typeof question.max === "number" ? question.max : 5;
    const selected = answers[question.answerKey] as number | undefined;
    const value = typeof selected === "number" && selected >= min && selected <= max ? selected : min;
    return (
      <div className={styles.sliderRow}>
        <input
          className={`${styles.input} ${styles.slider}`}
          id={question.questionId}
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => handleInputChange(question, Number(e.target.value))}
          onBlur={() => handleBlur(question)}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-labelledby={`${question.questionId}-label`}
        />
        <div className={styles.sliderValue} aria-hidden>{value}</div>
      </div>
    );
  }

  function renderTextarea(question: Question) {
    const rows = question.uiProps?.rows || 3;
    return (
      <textarea
        className={`${styles.input} ${styles.textarea}`}
        id={question.questionId}
        rows={rows}
        placeholder={question.placeholder}
        value={(answers[question.answerKey] as string) || ""}
        onChange={(e) => handleInputChange(question, e.target.value)}
        onBlur={() => handleBlur(question)}
        aria-invalid={Boolean(errorsByQuestionId[question.questionId])}
        aria-describedby={question.description ? `${question.questionId}-desc` : undefined}
      />
    );
  }

  function renderQuestionControl(question: Question) {
    switch (question.questionType) {
      case "text":
        return renderTextInput(question);
      case "email":
        return renderEmailInput(question);
      case "number":
        return renderNumberInput(question);
      case "date":
        return renderDateInput(question);
      case "mcq":
        return renderMCQ(question);
      case "checkbox":
        return renderCheckbox(question);
      case "rating":
        return renderRating(question);
      case "textarea":
        return renderTextarea(question);
      default:
        return null;
    }
  }

  function renderQuestion(question: Question) {
    const error = errorsByQuestionId[question.questionId];
    return (
      <div className={styles.question} key={question.questionId}>
        <label id={`${question.questionId}-label`} htmlFor={question.questionId} className={styles.label}>
          {question.label}
          {question.required ? <span className={styles.required}>*</span> : null}
        </label>
        {question.description ? (
          <div id={`${question.questionId}-desc`} className={styles.helpText}>
            {question.description}
          </div>
        ) : null}
        <div className={styles.control}>{renderQuestionControl(question)}</div>
        {error ? <div className={styles.errorText}>{error}</div> : null}
      </div>
    );
  }

  if (submitted && estimationResult) {
    return <EstimationResults estimation={estimationResult} onReset={resetForm} />;
  }

  if (submitted && !estimationResult) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <div className={styles.thankYou}>{thankYouMessage}</div>
        <div className={styles.navRow}>
          <button type="button" className={styles.primaryButton} onClick={resetForm}>
            Fill again
          </button>
        </div>
      </div>
    );
  }

  const currentSection = sections[sectionIndex];

  return (
    <div className={styles.mainWrapper}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>

      {showProgress ? (
        <div className={styles.progress} aria-label="Progress">
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={styles.progressText}>{answeredCount} / {totalQuestions} answered</div>
        </div>
      ) : null}

      {currentSection ? (
        <section className={styles.section} aria-labelledby={`section-${currentSection.sectionId}-title`}>
          <h2 id={`section-${currentSection.sectionId}-title`} className={styles.sectionTitle}>{currentSection.title}</h2>
          {currentSection.description ? (
            <p className={styles.sectionDescription}>{currentSection.description}</p>
          ) : null}
          {currentSection.sectionId === PER_ENV_TABS_SECTION_ID && currentSection.questionsByEnv ? (
            <>
              {(() => {
                const tabbedQuestions = currentSection.questionsByEnv.flat();
                const hasTabbedErrors = tabbedQuestions.some(
                  (q) => errorsByQuestionId[q.questionId]
                );
                return hasTabbedErrors ? (
                  <p className={styles.tabbedSectionError} role="alert">
                    Please complete the required fields in all environments before proceeding.
                  </p>
                ) : null;
              })()}
              <div className={styles.tabList} role="tablist" aria-label="Environments">
                {currentSection.questionsByEnv.map((_, idx) => {
                  const label = (answers[`env_name_${idx}`] as string)?.trim() || `Environment ${idx + 1}`;
                  const isSelected = activeTabIndex === idx;
                  return (
                    <button
                      key={`env-tab-${idx}`}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-controls={`tabpanel-${idx}`}
                      id={`tab-${idx}`}
                      className={`${styles.tab} ${isSelected ? styles.tabActive : ""}`}
                      onClick={() => setActiveTabIndex(idx)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div
                id={`tabpanel-${activeTabIndex}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTabIndex}`}
                className={styles.tabPanel}
              >
                <div className={styles.questionsList}>
                  {currentSection.questionsByEnv[activeTabIndex].map((q) => renderQuestion(q))}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.questionsList}>
              {currentSection.questions.map((q) => renderQuestion(q))}
            </div>
          )}
        </section>
      ) : null}

      <div className={styles.navRow}>
        <button type="button" className={styles.secondaryButton} onClick={goBack} disabled={sectionIndex === 0 || isSubmitting}>
          Back
        </button>
        {/* Show "Next" if: more sections exist, OR we're on setup and numEnvironments will trigger more sections */}
        {sectionIndex < sections.length - 1 || (currentSection?.sectionId === "setup" && sections.length === 1) ? (
          <button type="button" className={styles.primaryButton} onClick={goNext} disabled={isSubmitting}>
            Next
          </button>
        ) : (
          <button type="button" className={styles.primaryButton} onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Calculating..." : submitText}
          </button>
        )}
      </div>

      {submissionError && (
        <div className={styles.errorMessage} role="alert">
          {submissionError}
        </div>
      )}

        {allowSaveAndResume ? (
          <div className={styles.saveHint}>Your progress is saved automatically on this device.</div>
        ) : null}
      </div>

      <AIAutofillChatbot
        onDataExtracted={handleAIDataExtracted}
        isCollapsed={isChatbotCollapsed}
        onToggleCollapse={() => setIsChatbotCollapsed(!isChatbotCollapsed)}
      />
    </div>
  );
}


