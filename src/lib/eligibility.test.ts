import { describe, it, expect } from "vitest";
import { checkEligibility } from "@/lib/eligibility";
import type { EmployeeProfile, EligibilityRule } from "@/lib/types";

const profile: EmployeeProfile = {
  id: "p1",
  user_id: "u1",
  tenant_id: "t1",
  grade: "senior",
  tenure_months: 36,
  location: "Москва",
  legal_entity: "ООО Тест",
  extra: {},
};

describe("checkEligibility", () => {
  it("returns true when no rules", () => {
    expect(checkEligibility(profile, [])).toBe(true);
  });

  it("returns true when rule conditions match", () => {
    const rules: EligibilityRule[] = [{
      id: "r1",
      benefit_id: "b1",
      tenant_id: "t1",
      tenant_offering_id: null,
      conditions: { grade: ["senior", "lead"], min_tenure: 12 },
    }];
    expect(checkEligibility(profile, rules)).toBe(true);
  });

  it("returns false when no rule matches", () => {
    const rules: EligibilityRule[] = [{
      id: "r1",
      benefit_id: "b1",
      tenant_id: "t1",
      tenant_offering_id: null,
      conditions: { grade: ["junior"] },
    }];
    expect(checkEligibility(profile, rules)).toBe(false);
  });

  it("OR logic across rules - second rule passes", () => {
    const rules: EligibilityRule[] = [
      { id: "r1", benefit_id: "b1", tenant_id: "t1", tenant_offering_id: null, conditions: { grade: ["junior"] } },
      { id: "r2", benefit_id: "b1", tenant_id: "t1", tenant_offering_id: null, conditions: { location: ["Москва"] } },
    ];
    expect(checkEligibility(profile, rules)).toBe(true);
  });
});
