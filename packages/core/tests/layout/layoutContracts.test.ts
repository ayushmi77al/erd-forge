import { describe, expect, it } from "vitest";
import { estimateTableHeight, getTableKey } from "../../src/layout/contracts";

describe("Layout Contracts & Utilities", () => {
  it("estimates table height accurately based on column count", () => {
    // 0 columns -> minimum height 100
    expect(estimateTableHeight(0)).toBe(100);

    // 5 columns: 44 (header) + 5 * 32 (160) + 16 (padding) = 220
    expect(estimateTableHeight(5)).toBe(220);

    // 10 columns: 44 + 320 + 16 = 380
    expect(estimateTableHeight(10)).toBe(380);
  });

  it("derives deterministic collision-free table keys", () => {
    expect(getTableKey(undefined, undefined, "custom-id")).toBe("custom-id");
    expect(getTableKey("public", "users")).toBe("public.users");
    expect(getTableKey("analytics", "users")).toBe("analytics.users");
    expect(getTableKey(undefined, "users")).toBe("users");
    expect(getTableKey("public", "public.users")).toBe("public.users");
    expect(getTableKey()).toBe("unknown");
  });
});
