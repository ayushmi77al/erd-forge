import { describe, expect, it } from "vitest";
import elk from "@/core/layout/elkInstance";

describe("ELK Layout Engine Instance", () => {
  it("initializes and computes layout for a basic graph", async () => {
    const graph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
      },
      children: [
        { id: "node1", width: 200, height: 100 },
        { id: "node2", width: 200, height: 100 },
      ],
      edges: [{ id: "e1", sources: ["node1"], targets: ["node2"] }],
    };

    const layout = await elk.layout(graph);
    expect(layout).toBeDefined();
    expect(layout.children).toBeDefined();
    expect(layout.children!.length).toBe(2);

    const node1 = layout.children!.find((n) => n.id === "node1")!;
    const node2 = layout.children!.find((n) => n.id === "node2")!;

    expect(node1.x).toBeDefined();
    expect(node1.y).toBeDefined();
    expect(node2.x).toBeDefined();
    expect(node2.y).toBeDefined();

    // In RIGHT (LR) layered direction, source node1 must be placed to the left of target node2
    expect(node1.x!).toBeLessThan(node2.x!);
  });

  it("supports known layout algorithms inquiry", async () => {
    const algorithms = await elk.knownLayoutAlgorithms();
    expect(algorithms).toBeDefined();
    const ids = algorithms.map((a) => a.id);
    expect(ids).toContain("org.eclipse.elk.layered");
  });
});
