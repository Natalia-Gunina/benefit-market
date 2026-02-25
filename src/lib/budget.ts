import type { EmployeeProfile, BudgetPolicy } from "@/lib/types";
import { evaluateConditions } from "@/lib/domain/condition-evaluator";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find the best matching active budget policy for a given employee profile.
 *
 * - Only considers policies where `is_active` is `true`.
 * - Uses the same condition format as eligibility rules.
 * - If **multiple** policies match, returns the one with the **highest**
 *   `points_amount` (i.e. the most generous policy wins).
 * - Returns `null` if no active policy matches the employee.
 */
export function findApplicablePolicy(
  profile: EmployeeProfile,
  policies: BudgetPolicy[],
): BudgetPolicy | null {
  if (!policies || policies.length === 0) return null;

  let bestPolicy: BudgetPolicy | null = null;

  for (const policy of policies) {
    if (!policy.is_active) continue;

    if (evaluateConditions(profile, policy.target_filter)) {
      if (!bestPolicy || policy.points_amount > bestPolicy.points_amount) {
        bestPolicy = policy;
      }
    }
  }

  return bestPolicy;
}
