import { AnswerValue, Question } from "./types";

function coerceEmailValid(email: string): boolean {
  const emailRegex = /\S+@\S+\.[A-Za-z]{2,}/;
  return emailRegex.test(email);
}

export function validateAnswer(question: Question, value: AnswerValue): string | undefined {
  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

  if (question.required && isEmpty) {
    return "This field is required.";
  }

  if (isEmpty) return undefined;

  const rule = question.validation;
  if (!rule) return undefined;

  if (rule.type === "email" && typeof value === "string") {
    if (!coerceEmailValid(value)) return "Please enter a valid email.";
  }

  if (rule.type === "number") {
    const numeric = typeof value === "number" ? value : Number(value as any);
    if (Number.isNaN(numeric)) return "Please enter a valid number.";
    if (typeof question.min === "number" && numeric < question.min) {
      return `Value must be ≥ ${question.min}.`;
    }
    if (typeof question.max === "number" && numeric > question.max) {
      return `Value must be ≤ ${question.max}.`;
    }
  }

  if (rule.type === "string" && typeof value === "string") {
    if (typeof rule.minLength === "number" && value.length < rule.minLength) {
      return `Minimum ${rule.minLength} characters required.`;
    }
    if (typeof rule.maxLength === "number" && value.length > rule.maxLength) {
      return `Maximum ${rule.maxLength} characters allowed.`;
    }
  }

  if (rule.type === "regex" && typeof value === "string" && rule.pattern) {
    try {
      const re = new RegExp(rule.pattern);
      if (!re.test(value)) return "Value does not match the required pattern.";
    } catch {
      return undefined;
    }
  }

  return undefined;
}


