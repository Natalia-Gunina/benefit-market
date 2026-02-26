import type { EmployeeProfile } from "@/lib/types";

// ---------------------------------------------------------------------------
// Shared condition types used in eligibility_rules.conditions
// and budget_policies.target_filter JSON columns
// ---------------------------------------------------------------------------

/** Structured condition inside the match_all array */
export interface MatchCondition {
  field: string;
  operator: "in" | "gte" | "lte" | "eq";
  value: unknown;
}

/** Condition set stored as JSON — supports structured and flat formats */
export interface ConditionSet {
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
  condition: MatchCondition,
): boolean {
  const { field, operator, value } = condition;
  const profileValue = (profile as Record<string, unknown>)[field];

  switch (operator) {
    case "in":
      if (!Array.isArray(value)) return false;
      return value.includes(profileValue);
    case "gte":
      return (
        typeof profileValue === "number" && profileValue >= (value as number)
      );
    case "lte":
      return (
        typeof profileValue === "number" && profileValue <= (value as number)
      );
    case "eq":
      return profileValue === value;
    default:
      return false;
  }
}

/**
 * Evaluate the flat / shorthand conditions against an employee profile.
 * All present conditions must match (AND logic).
 */
function evaluateFlatConditions(
  profile: EmployeeProfile,
  conditions: ConditionSet,
): boolean {
  if (conditions.grade && conditions.grade.length > 0) {
    if (!conditions.grade.includes(profile.grade)) return false;
  }
  if (conditions.min_tenure !== undefined && conditions.min_tenure !== null) {
    if (profile.tenure_months < conditions.min_tenure) return false;
  }
  if (conditions.location && conditions.location.length > 0) {
    if (!conditions.location.includes(profile.location)) return false;
  }
  if (conditions.legal_entity && conditions.legal_entity.length > 0) {
    if (!conditions.legal_entity.includes(profile.legal_entity)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a condition set (JSON from DB) against an employee profile.
 *
 * - Empty or null conditions → returns `true` (matches everyone).
 * - `match_all` format: all conditions must pass (AND).
 * - Flat format: all present fields must match (AND).
 */
export function evaluateConditions(
  profile: EmployeeProfile,
  conditions: unknown,
): boolean {
  const conds = conditions as ConditionSet | null | undefined;

  if (!conds || Object.keys(conds).length === 0) {
    return true;
  }

  if (conds.match_all !== undefined) {
    if (conds.match_all.length === 0) return true;
    return conds.match_all.every((c) => evaluateMatchCondition(profile, c));
  }

  return evaluateFlatConditions(profile, conds);
}
