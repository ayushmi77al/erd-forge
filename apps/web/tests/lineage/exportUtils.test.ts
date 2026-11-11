// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { arrayBufferToBase64, getEmbeddedFontCSS } from "@/lineage/utils/exportUtils";

describe("exportUtils font embedding", () => {
  it("converts small buffers to base64 accurately", () => {
    const text = "Hello ERD Forge font embedding";
    const encoder = new TextEncoder();
    const buffer = encoder.encode(text).buffer;

    const base64 = arrayBufferToBase64(buffer);
    const decoded = atob(base64);
    expect(decoded).toBe(text);
  });

  it("safely converts 100KB+ buffers without call-stack overflow", () => {
    // 120,000 bytes - easily exceeds standard JavaScript argument/callstack limits (>65536)
    const largeSize = 120_000;
    const uint8 = new Uint8Array(largeSize);
    for (let i = 0; i < largeSize; i++) {
      uint8[i] = i % 256;
    }

    // Should not throw RangeError: Maximum call stack size exceeded
    const base64 = arrayBufferToBase64(uint8.buffer);
    expect(base64).toBeDefined();
    expect(typeof base64).toBe("string");

    // Verify round-trip integrity on sample chunk
    const decodedBinary = atob(base64);
    expect(decodedBinary.length).toBe(largeSize);
    expect(decodedBinary.charCodeAt(0)).toBe(0);
    expect(decodedBinary.charCodeAt(255)).toBe(255);
    expect(decodedBinary.charCodeAt(256)).toBe(0);
  });

  it("constructs fontEmbedCSS when font fetch succeeds", async () => {
    const fakeFontData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: async () => fakeFontData,
    } as any);

    const css = await getEmbeddedFontCSS();

    expect(fetchSpy).toHaveBeenCalled();
    expect(css).toContain("@font-face");
    expect(css).toContain("font-family: 'Inter Variable'");
    expect(css).toContain("data:font/woff2;base64,");
    expect(css).toContain(".react-flow__node");

    fetchSpy.mockRestore();
  });

  it("degrades gracefully to empty string when fetch fails or is offline", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network offline"));

    const css = await getEmbeddedFontCSS();

    expect(css).toBe("");

    fetchSpy.mockRestore();
  });
});

describe("downloadImage stabilization", () => {
  it("invokes html-to-image with cacheBust, backgroundColor, and UI filter", async () => {
    const { downloadImage } = await import("@/lineage/utils/exportUtils");
    const htmlToImage = await import("html-to-image");

    let capturedOptions: any = null;
    vi.spyOn(htmlToImage, "toPng").mockImplementation(async (_el, opts) => {
      capturedOptions = opts;
      return "data:image/png;base64,fakePngData";
    });

    const fakeElement = document.createElement("div");
    // Mock anchor click
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadImage(fakeElement, "png", "test-diagram");

    expect(capturedOptions).toBeDefined();
    expect(capturedOptions.backgroundColor).toBe("#0f111a");
    expect(capturedOptions.cacheBust).toBe(true);
    expect(typeof capturedOptions.filter).toBe("function");

    // Test the filter function
    const normalNode = document.createElement("div");
    const minimapNode = document.createElement("div");
    minimapNode.classList.add("react-flow__minimap");
    const controlsNode = document.createElement("div");
    controlsNode.classList.add("react-flow__controls");

    expect(capturedOptions.filter(normalNode)).toBe(true);
    expect(capturedOptions.filter(minimapNode)).toBe(false);
    expect(capturedOptions.filter(controlsNode)).toBe(false);

    clickSpy.mockRestore();
  });
});

describe("exportUtils OWASP CSV Sanitization", () => {
  it("sanitizes dangerous formulas and preserves safe strings according to OWASP fixtures", async () => {
    const { sanitizeCsvCell } = await import("@/lineage/utils/exportUtils");
    const { csvSecurityFixtures } = await import("../fixtures/csv/csvFixtures");

    csvSecurityFixtures.forEach((tc) => {
      const sanitized = sanitizeCsvCell(tc.rawInput);
      expect(sanitized).toBe(tc.expectedSanitizedCell);
    });
  });

  it("handles null, undefined, and empty string safely", async () => {
    const { sanitizeCsvCell } = await import("@/lineage/utils/exportUtils");

    expect(sanitizeCsvCell("")).toBe('""');
    expect(sanitizeCsvCell(undefined)).toBe('""');
  });

  it("exports lineage graph to CSV neutralizing formula injections in table and column names", async () => {
    const { exportLineageToCsv } = await import("@/lineage/utils/exportUtils");

    const mockGraph: any = {
      nodes: [
        { id: "node1", name: "=MALWARE()", type: "table" },
        { id: "node2", name: "SafeTable", type: "table" },
      ],
      edges: [
        {
          id: "e1",
          type: "table",
          sourceNodeId: "node1",
          targetNodeId: "node2",
          columnLineage: [
            {
              sourceColumnName: "+calc|'cmd'!A0",
              targetColumnName: "safe_col",
              transformation: "-SUM(1,2)",
              isDirect: true,
            },
          ],
        },
      ],
    };

    let generatedBlob: Blob | null = null;
    vi.spyOn(globalThis, "Blob").mockImplementation((parts: any, opts: any) => {
      generatedBlob = { parts, opts } as any;
      return generatedBlob as any;
    });

    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    globalThis.URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    exportLineageToCsv(mockGraph, "lineage-export");

    expect(generatedBlob).toBeDefined();
    const csvContent = (generatedBlob as any).parts[0];

    // Assert that dangerous values are neutralized with prepended single quote inside quotes
    expect(csvContent).toContain(`"'=MALWARE()"`);
    expect(csvContent).toContain(`"'+calc|'cmd'!A0"`);
    expect(csvContent).toContain(`"'-SUM(1,2)"`);
    expect(csvContent).toContain(`"SafeTable"`);

    clickSpy.mockRestore();
  });
});
