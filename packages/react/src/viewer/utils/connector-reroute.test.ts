import { describe, it, expect } from "vitest";
import type { PptxElement } from "pptx-viewer-core";
import {
  rerouteConnectorsForMovedElements,
  computeConnectorGeometry,
  applyReroutedConnectors,
} from "./connector-reroute";

// ---------------------------------------------------------------------------
// Helper: minimal element factory
// ---------------------------------------------------------------------------

function makeShape(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): PptxElement {
  return { id, type: "shape", x, y, width, height } as PptxElement;
}

function makeConnector(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  startShapeId?: string,
  startSiteIndex?: number,
  endShapeId?: string,
  endSiteIndex?: number,
): PptxElement {
  return {
    id,
    type: "connector",
    x,
    y,
    width,
    height,
    shapeType: "straightConnector1",
    shapeStyle: {
      strokeColor: "#000",
      connectorStartConnection: startShapeId
        ? { shapeId: startShapeId, connectionSiteIndex: startSiteIndex ?? 0 }
        : undefined,
      connectorEndConnection: endShapeId
        ? { shapeId: endShapeId, connectionSiteIndex: endSiteIndex ?? 0 }
        : undefined,
    },
  } as PptxElement;
}

// ---------------------------------------------------------------------------
// rerouteConnectorsForMovedElements
// ---------------------------------------------------------------------------

describe("rerouteConnectorsForMovedElements", () => {
  it("returns empty array when no elements were moved", () => {
    const elements = [
      makeShape("s1", 0, 0, 100, 100),
      makeConnector("c1", 50, 0, 50, 50, "s1", 0, "s2", 2),
      makeShape("s2", 100, 50, 100, 100),
    ];
    const result = rerouteConnectorsForMovedElements(elements, new Set());
    expect(result).toEqual([]);
  });

  it("returns empty array when no connectors reference moved elements", () => {
    const elements = [
      makeShape("s1", 0, 0, 100, 100),
      makeShape("s2", 200, 0, 100, 100),
      makeConnector("c1", 50, 0, 150, 50, "s1", 0, "s2", 0),
    ];
    // Move s3 which doesn't exist — no connectors reference it
    const result = rerouteConnectorsForMovedElements(
      elements,
      new Set(["s3"]),
    );
    expect(result).toEqual([]);
  });

  it("reroutes connector when start shape is moved", () => {
    // Shape s1 at (100, 100), 200x100 — site 0 (top center) = (200, 100)
    // Shape s2 at (400, 300), 200x100 — site 2 (bottom center) = (500, 400)
    const elements = [
      makeShape("s1", 100, 100, 200, 100),
      makeShape("s2", 400, 300, 200, 100),
      // Connector from s1 top-center to s2 bottom-center
      makeConnector("c1", 200, 100, 300, 300, "s1", 0, "s2", 2),
    ];

    const result = rerouteConnectorsForMovedElements(
      elements,
      new Set(["s1"]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
    // s1 site 0 (top center) = (100 + 100, 100 + 0) = (200, 100)
    // s2 site 2 (bottom center) = (400 + 100, 300 + 100) = (500, 400)
    expect(result[0].x).toBe(200);
    expect(result[0].y).toBe(100);
    expect(result[0].width).toBe(300);
    expect(result[0].height).toBe(300);
  });

  it("reroutes connector when end shape is moved", () => {
    // s1 at (0,0), 100x100, site 1 (right center) = (100, 50)
    // s2 moved to (300, 200), 100x100, site 3 (left center) = (300, 250)
    const elements = [
      makeShape("s1", 0, 0, 100, 100),
      makeShape("s2", 300, 200, 100, 100),
      makeConnector("c1", 100, 50, 200, 200, "s1", 1, "s2", 3),
    ];

    const result = rerouteConnectorsForMovedElements(
      elements,
      new Set(["s2"]),
    );
    expect(result).toHaveLength(1);
    // s1 site 1 (right center) = (0+100, 0+50) = (100, 50)
    // s2 site 3 (left center) = (300+0, 200+50) = (300, 250)
    expect(result[0].x).toBe(100);
    expect(result[0].y).toBe(50);
    expect(result[0].width).toBe(200);
    expect(result[0].height).toBe(200);
  });

  it("reroutes connector when both shapes are moved", () => {
    const elements = [
      makeShape("s1", 50, 50, 100, 100),
      makeShape("s2", 250, 250, 100, 100),
      makeConnector("c1", 100, 50, 200, 200, "s1", 0, "s2", 2),
    ];

    const result = rerouteConnectorsForMovedElements(
      elements,
      new Set(["s1", "s2"]),
    );
    expect(result).toHaveLength(1);
    // s1 site 0 (top center) = (50+50, 50+0) = (100, 50)
    // s2 site 2 (bottom center) = (250+50, 250+100) = (300, 350)
    expect(result[0].x).toBe(100);
    expect(result[0].y).toBe(50);
    expect(result[0].width).toBe(200);
    expect(result[0].height).toBe(300);
  });

  it("skips connectors that are themselves being moved", () => {
    const elements = [
      makeShape("s1", 50, 50, 100, 100),
      makeConnector("c1", 100, 50, 100, 100, "s1", 0, "s2", 2),
      makeShape("s2", 200, 200, 100, 100),
    ];

    // Both the shape and the connector are being moved
    const result = rerouteConnectorsForMovedElements(
      elements,
      new Set(["s1", "c1"]),
    );
    expect(result).toEqual([]);
  });

  it("handles connectors with only start connection", () => {
    const elements = [
      makeShape("s1", 0, 0, 200, 100),
      // Connector with start connection only (no end connection)
      makeConnector("c1", 100, 0, 200, 200, "s1", 0),
    ];

    const result = rerouteConnectorsForMovedElements(
      elements,
      new Set(["s1"]),
    );
    expect(result).toHaveLength(1);
    // s1 site 0 (top center) = (0+100, 0+0) = (100, 0)
    // No end connection — use existing: (100+200, 0+200) = (300, 200)
    expect(result[0].x).toBe(100);
    expect(result[0].y).toBe(0);
    expect(result[0].width).toBe(200);
    expect(result[0].height).toBe(200);
  });

  it("handles connectors with only end connection", () => {
    const elements = [
      makeShape("s2", 300, 300, 200, 100),
      // Connector with end connection only (no start connection)
      makeConnector("c1", 50, 50, 250, 300, undefined, undefined, "s2", 2),
    ];

    const result = rerouteConnectorsForMovedElements(
      elements,
      new Set(["s2"]),
    );
    expect(result).toHaveLength(1);
    // No start connection — use existing: (50, 50)
    // s2 site 2 (bottom center) = (300+100, 300+100) = (400, 400)
    expect(result[0].x).toBe(50);
    expect(result[0].y).toBe(50);
    expect(result[0].width).toBe(350);
    expect(result[0].height).toBe(350);
  });

  it("reroutes multiple connectors for same moved shape", () => {
    const elements = [
      makeShape("s1", 100, 100, 100, 100),
      makeShape("s2", 300, 100, 100, 100),
      makeShape("s3", 100, 300, 100, 100),
      makeConnector("c1", 150, 100, 200, 0, "s1", 0, "s2", 0),
      makeConnector("c2", 150, 200, 0, 100, "s1", 2, "s3", 0),
    ];

    const result = rerouteConnectorsForMovedElements(
      elements,
      new Set(["s1"]),
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual(["c1", "c2"]);
  });
});

// ---------------------------------------------------------------------------
// computeConnectorGeometry
// ---------------------------------------------------------------------------

describe("computeConnectorGeometry", () => {
  it("returns null when start shape not found", () => {
    const connector = makeConnector("c1", 0, 0, 100, 100);
    const elementMap = new Map<string, PptxElement>();

    const result = computeConnectorGeometry(
      connector,
      { shapeId: "missing", connectionSiteIndex: 0 },
      undefined,
      elementMap,
    );
    expect(result).toBeNull();
  });

  it("returns null when end shape not found", () => {
    const s1 = makeShape("s1", 0, 0, 100, 100);
    const connector = makeConnector("c1", 0, 0, 100, 100);
    const elementMap = new Map<string, PptxElement>([["s1", s1]]);

    const result = computeConnectorGeometry(
      connector,
      { shapeId: "s1", connectionSiteIndex: 0 },
      { shapeId: "missing", connectionSiteIndex: 0 },
      elementMap,
    );
    expect(result).toBeNull();
  });

  it("computes geometry for two connected shapes", () => {
    const s1 = makeShape("s1", 0, 0, 100, 100);
    const s2 = makeShape("s2", 200, 200, 100, 100);
    const connector = makeConnector("c1", 0, 0, 200, 200);
    const elementMap = new Map<string, PptxElement>([
      ["s1", s1],
      ["s2", s2],
    ]);

    const result = computeConnectorGeometry(
      connector,
      { shapeId: "s1", connectionSiteIndex: 1 }, // right center = (100, 50)
      { shapeId: "s2", connectionSiteIndex: 3 }, // left center = (200, 250)
      elementMap,
    );
    expect(result).not.toBeNull();
    expect(result!.x).toBe(100);
    expect(result!.y).toBe(50);
    expect(result!.width).toBe(100);
    expect(result!.height).toBe(200);
  });

  it("ensures minimum width of 1", () => {
    const s1 = makeShape("s1", 0, 0, 100, 100);
    const s2 = makeShape("s2", 0, 200, 100, 100);
    const connector = makeConnector("c1", 50, 100, 1, 100);
    const elementMap = new Map<string, PptxElement>([
      ["s1", s1],
      ["s2", s2],
    ]);

    // Both at x=50 (top center of both) → width would be 0
    const result = computeConnectorGeometry(
      connector,
      { shapeId: "s1", connectionSiteIndex: 0 }, // top center = (50, 0)
      { shapeId: "s2", connectionSiteIndex: 0 }, // top center = (50, 200)
      elementMap,
    );
    expect(result).not.toBeNull();
    expect(result!.width).toBe(1); // minimum width
    expect(result!.height).toBe(200);
  });

  it("uses different connection site indices correctly", () => {
    const s1 = makeShape("s1", 0, 0, 200, 100);
    const s2 = makeShape("s2", 300, 0, 200, 100);
    const connector = makeConnector("c1", 0, 0, 300, 100);
    const elementMap = new Map<string, PptxElement>([
      ["s1", s1],
      ["s2", s2],
    ]);

    // Sites: 0=top-center, 1=right-center, 2=bottom-center, 3=left-center
    const result = computeConnectorGeometry(
      connector,
      { shapeId: "s1", connectionSiteIndex: 2 }, // bottom center = (100, 100)
      { shapeId: "s2", connectionSiteIndex: 0 }, // top center = (400, 0)
      elementMap,
    );
    expect(result).not.toBeNull();
    expect(result!.x).toBe(100);
    expect(result!.y).toBe(0);
    expect(result!.width).toBe(300);
    expect(result!.height).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// applyReroutedConnectors
// ---------------------------------------------------------------------------

describe("applyReroutedConnectors", () => {
  it("returns original array when no reroutes", () => {
    const elements = [
      makeShape("s1", 0, 0, 100, 100),
      makeConnector("c1", 50, 0, 50, 50),
    ];
    const result = applyReroutedConnectors(elements, []);
    expect(result).toBe(elements); // same reference
  });

  it("updates only rerouted connector geometry", () => {
    const elements = [
      makeShape("s1", 0, 0, 100, 100),
      makeConnector("c1", 50, 0, 50, 50),
      makeShape("s2", 200, 200, 100, 100),
    ];

    const rerouted = [{ id: "c1", x: 100, y: 50, width: 200, height: 200 }];
    const result = applyReroutedConnectors(elements, rerouted);

    expect(result).not.toBe(elements);
    expect(result).toHaveLength(3);
    // Shape s1 unchanged
    expect(result[0]).toBe(elements[0]);
    // Connector c1 updated
    expect(result[1].x).toBe(100);
    expect(result[1].y).toBe(50);
    expect(result[1].width).toBe(200);
    expect(result[1].height).toBe(200);
    // Shape s2 unchanged
    expect(result[2]).toBe(elements[2]);
  });

  it("preserves non-geometric connector properties", () => {
    const connector = makeConnector(
      "c1", 0, 0, 100, 100,
      "s1", 0, "s2", 2,
    );
    const elements = [connector];

    const rerouted = [{ id: "c1", x: 10, y: 20, width: 300, height: 400 }];
    const result = applyReroutedConnectors(elements, rerouted);

    const updated = result[0] as unknown as {
      type: string;
      shapeStyle: { connectorStartConnection: { shapeId: string } };
    };
    expect(updated.type).toBe("connector");
    expect(updated.shapeStyle.connectorStartConnection.shapeId).toBe("s1");
  });
});
