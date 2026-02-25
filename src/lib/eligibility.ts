import type { EmployeeProfile, EligibilityRule } from "@/lib/types";
import { evaluateConditions } from "@/lib/domain/condition-evaluator";

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
  rules: EligibilityRule[],
): boolean {
  if (!rules || rules.length === 0) {
    return true;
  }

  return rules.some((rule) => evaluateConditions(profile, rule.conditions));
}
