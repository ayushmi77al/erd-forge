import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialDialect } from "./lineageStore";
import { getInitialAppMode } from "./uiStore";

describe("URL parameter initialization helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults appMode to schema when no mode param is set", () => {
    vi.stubGlobal("window", { location: { search: "" } });
    expect(getInitialAppMode()).toBe("schema");
  });

  it("resolves appMode=lineage from ?mode=lineage and rejects unknown values", () => {
    vi.stubGlobal("window", { location: { search: "?mode=lineage" } });
    expect(getInitialAppMode()).toBe("lineage");

    vi.stubGlobal("window", { location: { search: "?mode=invalid" } });
    expect(getInitialAppMode()).toBe("schema");
  });

  it("resolves supported SQL dialects case-insensitively and defaults unknown values to mssql", () => {
    vi.stubGlobal("window", { location: { search: "?mode=lineage&dialect=Snowflake" } });
    expect(getInitialDialect()).toBe("snowflake");

    vi.stubGlobal("window", { location: { search: "?dialect=bigquery" } });
    expect(getInitialDialect()).toBe("bigquery");

    vi.stubGlobal("window", { location: { search: "?dialect=unknown" } });
    expect(getInitialDialect()).toBe("mssql");
  });
});
