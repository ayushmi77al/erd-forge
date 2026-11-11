import { describe, expect, it } from "vitest";
import { csvSecurityFixtures, fixture50Tables, fixture500Tables, sqlFixtures } from "./index";

describe("Test Fixtures Integrity", () => {
  it("loads 50-table layout fixture with schema collisions and domains", () => {
    expect(fixture50Tables.tables.length).toBe(50);
    expect(fixture50Tables.refs.length).toBeGreaterThan(0);
    // Verify multi-schema collisions exist
    const userTables = fixture50Tables.tables.filter((t) => t.name === "users");
    expect(userTables.length).toBeGreaterThan(1);
    expect(new Set(userTables.map((t) => t.schema)).size).toBeGreaterThan(1);
  });

  it("loads 500-table layout stress fixture", () => {
    expect(fixture500Tables.tables.length).toBe(500);
    expect(fixture500Tables.refs.length).toBeGreaterThan(300);
  });

  it("contains multi-dialect SQL fixtures covering key warehouse features", () => {
    expect(sqlFixtures.length).toBeGreaterThanOrEqual(7);
    const dialects = sqlFixtures.map((f) => f.dialect);
    expect(dialects).toContain("snowflake");
    expect(dialects).toContain("bigquery");
    expect(dialects).toContain("databricks");
    expect(dialects).toContain("duckdb");
    expect(dialects).toContain("postgresql");
  });

  it("contains formula injection and legitimate CSV security cases", () => {
    expect(csvSecurityFixtures.length).toBeGreaterThanOrEqual(8);
    const dangerousCases = csvSecurityFixtures.filter((c) => c.isDangerous);
    expect(dangerousCases.length).toBeGreaterThanOrEqual(5);
  });
});
