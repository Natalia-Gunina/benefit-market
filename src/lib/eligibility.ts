import type { EmployeeProfile, EligibilityRule } from "@/lib/types";

// ---------------------------------------------------------------------------
// Condition types used in eligibility_rules.conditions JSON
// ---------------------------------------------------------------------------

/** Structured condition inside the match_all array (seed data format) */
interface MatchCondition {
  field: string;
  operator: "in" | "gte" | "lte" | "eq";
  value: unknown;
}

/** The full conditions JSON stored in eligibility_rules.conditions */
interface RuleConditions {
  // Structured format (used in seed data)
  match_all?: MatchCondition[];

  // Shorthand flat format (alternative convenience notation)
  grade?: string[];
  min_tenure?: number;
  location?: string[];
  legal_entity?: string[];

  // Metadata (ignored for evaluation)
  rule_name?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate a single structured condition against an employee profile.
 */
function evaluateMatchCondition(
  profile: EmployeeProfile,
  condition: MatchCondition
): boolean {
  const { field, operator, value } = condition;

  // Resolve the profile value for the given field name
  const profileValue = (profile as Record<string, unknown>)[field];

  switch (operator) {
    case "in":
      // value is expected to be an array; profile field must be in that array
      if (!Array.isArray(value)) return false;
      return value.includes(profileValue);

    case "gte":
      // value is a number; profile field must be >= value
      return typeof profileValue === "number" && profileValue >= (value as number);

    case "lte":
      return typeof profileValue === "number" && profileValue <= (value as number);

    case "eq":
      return profileValue === value;

    default:
      // Unknown operator — treat as non-matching to be safe
      return false;
  }
}

/**
 * Evaluate the flat / shorthand conditions against an employee profile.
 * All present conditions must match (AND logic).
 */
function evaluateFlatConditions(
  profile: EmployeeProfile,
  conditions: RuleConditions
): boolean {
  // grade: string[] — profile.grade must be in the list
  if (conditions.grade && conditions.grade.length > 0) {
    if (!conditions.grade.includes(profile.grade)) return false;
  }

  // min_tenure: number — profile.tenure_months must be >= value
  if (conditions.min_tenure !== undefined && conditions.min_tenure !== null) {
    if (profile.tenure_months < conditions.min_tenure) return false;
  }

  // location: string[] — profile.location must be in the list
  if (conditions.location && conditions.location.length > 0) {
    if (!conditions.location.includes(profile.location)) return false;
  }

  // legal_entity: string[] — profile.legal_entity must be in the list
  if (conditions.legal_entity && conditions.legal_entity.length > 0) {
    if (!conditions.legal_entity.includes(profile.legal_entity)) return false;
  }

  return true;
}

/**
 * Evaluate a single eligibility rule against an employee profile.
 * Returns true if the employee satisfies all conditions in the rule.
 */
function evaluateRule(
  profile: EmployeeProfile,
  rule: EligibilityRule
): boolean {
  const conditions = rule.conditions as RuleConditions | null | undefined;

  // No conditions or empty object → benefit is available to all
  if (!conditions || Object.keys(conditions).length === 0) {
    return true;
  }

  // --- Structured match_all format ---
  if (conditions.match_all !== undefined) {
    // Empty match_all array → available to all
    if (conditions.match_all.length === 0) return true;

    // All conditions in match_all must pass (AND logic)
    return conditions.match_all.every((cond) =>
      evaluateMatchCondition(profile, cond)
    );
  }

  // --- Flat / shorthand format ---
  return evaluateFlatConditions(profile, conditions);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if an employee is eligible for a benefit given its eligibility rules.
 *
 * - If there are **no rules** for the benefit → returns `true` (available to all).
 * - Within a single rule, all conditions must match (**AND** logic).
 * - Across multiple rules, **any** rule passing means the employee is eligible
 *   (**OR** between rules).
 */
export function checkEligibility(
  profile: EmployeeProfile,
  rules: EligibilityRule[]
): boolean {
  // No rules → benefit is available to all employees
  if (!rules || rules.length === 0) {
    return true;
  }

  // OR across rules — at least one rule must pass
  return rules.some((rule) => evaluateRule(profile, rule));
}
