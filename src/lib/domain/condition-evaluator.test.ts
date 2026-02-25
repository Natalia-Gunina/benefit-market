import { describe, it, expect } from "vitest";
import { evaluateConditions } from "@/lib/domain/condition-evaluator";
import type { EmployeeProfile } from "@/lib/types";

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

describe("evaluateConditions", () => {
  it("returns true for null conditions", () => {
    expect(evaluateConditions(profile, null)).toBe(true);
  });

  it("returns true for empty conditions", () => {
    expect(evaluateConditions(profile, {})).toBe(true);
  });

  it("evaluates match_all format - all pass", () => {
    expect(evaluateConditions(profile, {
      match_all: [
        { field: "grade", operator: "in", value: ["senior", "lead"] },
        { field: "tenure_months", operator: "gte", value: 12 },
      ],
    })).toBe(true);
  });

  it("evaluates match_all format - one fails", () => {
    expect(evaluateConditions(profile, {
      match_all: [
        { field: "grade", operator: "in", value: ["junior"] },
      ],
    })).toBe(false);
  });

  it("evaluates flat format - grade match", () => {
    expect(evaluateConditions(profile, { grade: ["senior", "lead"] })).toBe(true);
  });

  it("evaluates flat format - grade mismatch", () => {
    expect(evaluateConditions(profile, { grade: ["junior"] })).toBe(false);
  });

  it("evaluates flat format - min_tenure pass", () => {
    expect(evaluateConditions(profile, { min_tenure: 24 })).toBe(true);
  });

  it("evaluates flat format - min_tenure fail", () => {
    expect(evaluateConditions(profile, { min_tenure: 48 })).toBe(false);
  });

  it("evaluates flat format - location match", () => {
    expect(evaluateConditions(profile, { location: ["Москва", "СПб"] })).toBe(true);
  });

  it("evaluates flat format - location mismatch", () => {
    expect(evaluateConditions(profile, { location: ["Казань"] })).toBe(false);
  });

  it("evaluates combined flat conditions - AND logic", () => {
    expect(evaluateConditions(profile, {
      grade: ["senior"],
      min_tenure: 24,
      location: ["Москва"],
    })).toBe(true);
  });

  it("evaluates lte operator", () => {
    expect(evaluateConditions(profile, {
      match_all: [{ field: "tenure_months", operator: "lte", value: 36 }],
    })).toBe(true);
    expect(evaluateConditions(profile, {
      match_all: [{ field: "tenure_months", operator: "lte", value: 12 }],
    })).toBe(false);
  });

  it("evaluates eq operator", () => {
    expect(evaluateConditions(profile, {
      match_all: [{ field: "grade", operator: "eq", value: "senior" }],
    })).toBe(true);
  });
});
