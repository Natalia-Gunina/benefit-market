import type { EmployeeProfile, BudgetPolicy } from "@/lib/types";

// ---------------------------------------------------------------------------
// Condition types — reuses the same format as eligibility rules
// ---------------------------------------------------------------------------

interface MatchCondition {
  field: string;
  operator: "in" | "gte" | "lte" | "eq";
  value: unknown;
}

interface TargetFilter {
  // Structured format (used in seed data)
  match_all?: MatchCondition[];

  // Shorthand flat format
  grade?: string[];
  min_tenure?: number;
  location?: string[];
  legal_entity?: string[];

  // Metadata (ignored for evaluation)
  description?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function evaluateMatchCondition(
  profile: EmployeeProfile,
  condition: MatchCondition
): boolean {
  const { field, operator, value } = condition;
  const profileValue = (profile as Record<string, unknown>)[field];

  switch (operator) {
    case "in":
      if (!Array.isArray(value)) return false;
      return value.includes(profileValue);
    case "gte":
      return typeof profileValue === "number" && profileValue >= (value as number);
    case "lte":
      return typeof profileValue === "number" && profileValue <= (value as number);
    case "eq":
      return profileValue === value;
    default:
      return false;
  }
}

function evaluateFlatConditions(
  profile: EmployeeProfile,
  filter: TargetFilter
): boolean {
  if (filter.grade && filter.grade.length > 0) {
    if (!filter.grade.includes(profile.grade)) return false;
  }
  if (filter.min_tenure !== undefined && filter.min_tenure !== null) {
    if (profile.tenure_months < filter.min_tenure) return false;
  }
  if (filter.location && filter.location.length > 0) {
    if (!filter.location.includes(profile.location)) return false;
  }
  if (filter.legal_entity && filter.legal_entity.length > 0) {
    if (!filter.legal_entity.includes(profile.legal_entity)) return false;
  }
  return true;
}

/**
 * Check if an employee profile matches a budget policy's target_filter.
 */
function matchesPolicy(
  profile: EmployeeProfile,
  policy: BudgetPolicy
): boolean {
  const filter = policy.target_filter as TargetFilter | null | undefined;

  // No filter or empty → matches everyone
  if (!filter || Object.keys(filter).length === 0) {
    return true;
  }

  // Structured match_all format
  if (filter.match_all !== undefined) {
    if (filter.match_all.length === 0) return true;
    return filter.match_all.every((cond) =>
      evaluateMatchCondition(profile, cond)
    );
  }

  // Flat format
  return evaluateFlatConditions(profile, filter);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find the best matching active budget policy for a given employee profile.
 *
 * - Only considers policies where `is_active` is `true`.
 * - Uses the same filter format as eligibility conditions (`match_all` or flat).
 * - If **multiple** policies match, returns the one with the **highest**
 *   `points_amount` (i.e. the most generous policy wins).
 * - Returns `null` if no active policy matches the employee.
 */
export function findApplicablePolicy(
  profile: EmployeeProfile,
  policies: BudgetPolicy[]
): BudgetPolicy | null {
  if (!policies || policies.length === 0) return null;

  let bestPolicy: BudgetPolicy | null = null;

  for (const policy of policies) {
    // Skip inactive policies
    if (!policy.is_active) continue;

    if (matchesPolicy(profile, policy)) {
      if (!bestPolicy || policy.points_amount > bestPolicy.points_amount) {
        bestPolicy = policy;
      }
    }
  }

  return bestPolicy;
}
