import { toPng, toSvg } from "html-to-image";
import type { LineageGraph } from "../models/LineageGraph";

/**
 * Stack-safe base64 conversion that handles arbitrary font file sizes
 * without exceeding the JavaScript call stack limit.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000; // 32KB chunk limit
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Resolves font URL dynamically relative to Vite's base path and creates
 * an inlined base64 @font-face style string for SVG/PNG canvas exports.
 */
export async function getEmbeddedFontCSS(): Promise<string> {
  try {
    const baseUrl = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
    const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const fontUrl = `${cleanBase}fonts/Inter-Variable.woff2`;

    const response = await fetch(fontUrl);
    if (!response.ok) return "";
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    return `
      @font-face {
        font-family: 'Inter Variable';
        src: url('data:font/woff2;base64,${base64}') format('woff2');
        font-weight: 100 900;
        font-display: block;
      }
      .react-flow__node {
        font-family: 'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif !important;
      }
    `;
  } catch {
    return ""; // Degrade gracefully to system font
  }
}

export const downloadImage = async (element: HTMLElement, format: "png" | "svg", filename: string) => {
  try {
    const fontEmbedCSS = await getEmbeddedFontCSS();

    const filter = (node: HTMLElement) => {
      // Filter out React Flow minimap, controls, and other UI overlays
      const excludeClasses = ["react-flow__minimap", "react-flow__controls", "react-flow__panel"];
      if (node.classList) {
        return !excludeClasses.some((c) => node.classList.contains(c));
      }
      return true;
    };

    const options = {
      filter,
      backgroundColor: "#0f111a",
      cacheBust: true,
      ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
    };

    const dataUrl = format === "png" ? await toPng(element, options) : await toSvg(element, options);

    const link = document.createElement("a");
    link.download = `${filename}.${format}`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error("Failed to export image", err);
    throw err;
  }
};

/**
 * Neutralizes CSV formula injection per OWASP guidelines.
 * Prepends a single quote to cells beginning with =, +, -, @, \t, or \r.
 */
export function sanitizeCsvCell(value: string | undefined): string {
  if (!value) return '""';
  const trimmed = value.trim();
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];
  let safe = value;
  if (dangerousPrefixes.some((p) => trimmed.startsWith(p))) {
    safe = `'${safe}`;
  }
  return `"${safe.replace(/"/g, '""')}"`;
}

export const exportLineageToCsv = (graph: LineageGraph | null, filename: string) => {
  if (!graph) return;

  // We want to export column-level lineage
  const csvRows = [
    ["Target Table", "Target Column", "Source Table", "Source Column", "Transformation", "Lineage Type"],
  ];

  graph.edges.forEach((edge) => {
    if (edge.type === "table" && edge.columnLineage && edge.columnLineage.length > 0) {
      edge.columnLineage.forEach((colMapping) => {
        const targetNode = graph.nodes.find((n) => n.id === edge.targetNodeId);
        const sourceNode = graph.nodes.find((n) => n.id === edge.sourceNodeId);

        csvRows.push([
          targetNode?.name || edge.targetNodeId || "",
          colMapping.targetColumnName || "",
          sourceNode?.name || edge.sourceNodeId || "",
          colMapping.sourceColumnName || "",
          colMapping.transformation || "",
          colMapping.isDirect ? "Direct" : `Indirect (${colMapping.context || "unknown"})`,
        ]);
      });
    }
  });

  const csvContent = csvRows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
