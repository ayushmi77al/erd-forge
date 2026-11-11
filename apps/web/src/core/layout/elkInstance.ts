import ElkBundled from "elkjs/lib/elk.bundled.js";
import ELK from "elkjs/lib/elk-api";

/**
 * Creates an ELK layout engine instance.
 * In browser environments, offloads layout computation to a dedicated Web Worker.
 * In headless/Node test environments, falls back to bundled runner.
 */
export function createElk(): InstanceType<typeof ELK> {
  if (typeof window !== "undefined" && typeof Worker !== "undefined") {
    try {
      return new ELK({
        workerFactory: () =>
          new Worker(new URL("elkjs/lib/elk-worker.min.js", import.meta.url), {
            type: "module",
          }),
      });
    } catch (err) {
      console.warn("ELK Web Worker initialization failed; falling back to bundled engine:", err);
    }
  }

  // Fallback for Vitest/Node environments without native browser WebWorker
  return new ElkBundled();
}

const elk = createElk();
export default elk;
