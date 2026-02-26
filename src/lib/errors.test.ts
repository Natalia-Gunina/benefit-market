import { describe, it, expect } from "vitest";
import { AppError, unauthorized, forbidden, notFound, validationError, dbError } from "@/lib/errors";

describe("AppError", () => {
  it("creates error with code and status", () => {
    const err = new AppError("NOT_FOUND", "Not found", 404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Not found");
    expect(err.status).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });

  it("defaults status to 500", () => {
    const err = new AppError("INTERNAL_ERROR", "oops");
    expect(err.status).toBe(500);
  });
});

describe("error factories", () => {
  it("unauthorized creates 401", () => {
    const err = unauthorized();
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("forbidden creates 403", () => {
    const err = forbidden("no access");
    expect(err.status).toBe(403);
    expect(err.message).toBe("no access");
  });

  it("notFound creates 404", () => {
    const err = notFound();
    expect(err.status).toBe(404);
  });

  it("validationError creates 400", () => {
    const err = validationError("bad input");
    expect(err.status).toBe(400);
    expect(err.message).toBe("bad input");
  });

  it("dbError creates 500", () => {
    const err = dbError("query failed");
    expect(err.status).toBe(500);
    expect(err.code).toBe("DB_ERROR");
  });
});
