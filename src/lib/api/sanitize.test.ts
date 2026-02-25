import { describe, it, expect } from "vitest";
import { escapeIlike } from "@/lib/api/sanitize";

describe("escapeIlike", () => {
  it("escapes percent signs", () => {
    expect(escapeIlike("50%")).toBe("50\\%");
  });

  it("escapes underscores", () => {
    expect(escapeIlike("user_name")).toBe("user\\_name");
  });

  it("escapes backslashes", () => {
    expect(escapeIlike("path\\file")).toBe("path\\\\file");
  });

  it("leaves normal text unchanged", () => {
    expect(escapeIlike("hello world")).toBe("hello world");
  });

  it("escapes multiple special chars", () => {
    expect(escapeIlike("50% off_sale\\")).toBe("50\\% off\\_sale\\\\");
  });
});
