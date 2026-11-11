import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  computeRelationFocus,
  getCardinality,
  getDirectionAngle,
  pickEdgeHandles,
} from "@/components/canvas/relationshipGeometry";

describe("ERD relationship geometry & focus helpers", () => {
  it("maps SDL reference directions to cardinalities and summaries", () => {
    expect(getCardinality(">")).toEqual({ source: "N", target: "1", summary: "N:1" });
    expect(getCardinality("<")).toEqual({ source: "1", target: "N", summary: "1:N" });
    expect(getCardinality("-")).toEqual({ source: "1", target: "1", summary: "1:1" });
    expect(getCardinality("<>")).toEqual({ source: "N", target: "N", summary: "N:N" });
    expect(getCardinality(undefined)).toEqual({ source: "", target: "", summary: "" });
  });

  it("maps React Flow handle positions to outward Crow's Foot angles", () => {
    expect(getDirectionAngle(Position.Right)).toBe(0);
    expect(getDirectionAngle(Position.Bottom)).toBe(90);
    expect(getDirectionAngle(Position.Left)).toBe(180);
    expect(getDirectionAngle(Position.Top)).toBe(-90);
  });

  it("picks facing inner handles when horizontally separated and same-side outer handles when stacked", () => {
    // Side-by-side: target is clearly to the right
    expect(pickEdgeHandles({ x: 80, y: 100 }, { x: 480, y: 100 }, "id", "user_id", 260)).toEqual({
      sourceHandle: "right-id",
      targetHandle: "left-user_id",
    });

    // Side-by-side: target is clearly to the left
    expect(pickEdgeHandles({ x: 520, y: 100 }, { x: 80, y: 100 }, "user_id", "id", 260)).toEqual({
      sourceHandle: "left-user_id",
      targetHandle: "right-id",
    });

    // Vertically stacked / horizontally overlapping: avoid routing through node box
    expect(pickEdgeHandles({ x: 200, y: 80 }, { x: 220, y: 380 }, "order_id", "id", 260)).toEqual({
      sourceHandle: "right-order_id",
      targetHandle: "right-id",
    });
    expect(pickEdgeHandles({ x: 220, y: 80 }, { x: 200, y: 380 }, "order_id", "id", 260)).toEqual({
      sourceHandle: "left-order_id",
      targetHandle: "left-id",
    });
  });

  it("derives connected tables, edges, and participating columns for edge and table focus", () => {
    const edges = [
      { id: "e1", source: "orders", target: "users", sourceColumn: "user_id", targetColumn: "id" },
      { id: "e2", source: "order_items", target: "orders", sourceColumn: "order_id", targetColumn: "id" },
      { id: "e3", source: "products", target: "categories", sourceColumn: "category_id", targetColumn: "id" },
    ];

    // Edge focus highlights only the two endpoint tables and exact columns
    const edgeFocus = computeRelationFocus(edges, null, "e1");
    expect(edgeFocus.isFocused).toBe(true);
    expect([...edgeFocus.activeEdgeIds]).toEqual(["e1"]);
    expect([...edgeFocus.activeTableIds].sort()).toEqual(["orders", "users"]);
    expect([...(edgeFocus.highlightedColumnsByTable.get("orders") ?? [])]).toEqual(["user_id"]);
    expect([...(edgeFocus.highlightedColumnsByTable.get("users") ?? [])]).toEqual(["id"]);
    expect(edgeFocus.highlightedColumnsByTable.has("products")).toBe(false);

    // Table focus highlights all edges touching that table
    const tableFocus = computeRelationFocus(edges, "orders", null);
    expect(tableFocus.isFocused).toBe(true);
    expect([...tableFocus.activeEdgeIds].sort()).toEqual(["e1", "e2"]);
    expect([...tableFocus.activeTableIds].sort()).toEqual(["order_items", "orders", "users"]);
    expect([...(tableFocus.highlightedColumnsByTable.get("orders") ?? [])].sort()).toEqual(["id", "user_id"]);

    // Idle focus disables dimming
    expect(computeRelationFocus(edges, null, null).isFocused).toBe(false);
  });
});
