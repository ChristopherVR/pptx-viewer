import { describe, it, expect } from "vitest";
import { PptxSmartArtParser } from "./PptxSmartArtParser";
import {
  extractTextFromPoint,
  getLocalName,
  extractParagraphText,
  collectLocalTextValues,
} from "./smart-art-text-helpers";
import type { XmlObject } from "../../types";

/**
 * Minimal xmlLookupService that works with fast-xml-parser-style objects.
 * Searches keys by local name (portion after ':').
 */
const xmlLookupService = {
  getChildByLocalName: (
    obj: XmlObject | undefined,
    name: string,
  ): XmlObject | undefined => {
    if (!obj || typeof obj !== "object") return undefined;
    for (const key of Object.keys(obj)) {
      const localName = key.includes(":") ? key.split(":")[1] : key;
      if (localName === name && typeof obj[key] === "object") {
        return obj[key] as XmlObject;
      }
    }
    return undefined;
  },
  getChildrenArrayByLocalName: (
    obj: XmlObject | undefined,
    name: string,
  ): XmlObject[] => {
    if (!obj || typeof obj !== "object") return [];
    for (const key of Object.keys(obj)) {
      const localName = key.includes(":") ? key.split(":")[1] : key;
      if (localName === name) {
        const value = obj[key];
        if (Array.isArray(value)) return value as XmlObject[];
        if (value && typeof value === "object") return [value as XmlObject];
      }
    }
    return [];
  },
};

// ---------------------------------------------------------------------------
// Layout type detection
// ---------------------------------------------------------------------------

describe("PptxSmartArtParser — layout type resolution", () => {
  const parser = new PptxSmartArtParser();

  it("resolves hierarchy layout from name containing 'hier'", () => {
    expect(parser.resolveLayoutCategory("hierarchy1")).toBe("hierarchy");
    expect(parser.resolveLayoutCategory("HierarchyLeft")).toBe("hierarchy");
  });

  it("resolves org chart layout from name containing 'org'", () => {
    expect(parser.resolveLayoutCategory("orgChart1")).toBe("hierarchy");
  });

  it("resolves process layout from name containing 'process' or 'flow'", () => {
    expect(parser.resolveLayoutCategory("basicProcess")).toBe("process");
    expect(parser.resolveLayoutCategory("flowChart1")).toBe("process");
  });

  it("resolves cycle layout from name containing 'cycle' or 'circular'", () => {
    expect(parser.resolveLayoutCategory("basicCycle")).toBe("cycle");
    expect(parser.resolveLayoutCategory("circularDiagram")).toBe("cycle");
  });

  it("resolves matrix layout from name containing 'matrix' or 'grid'", () => {
    expect(parser.resolveLayoutCategory("basicMatrix")).toBe("matrix");
    expect(parser.resolveLayoutCategory("grid2x2")).toBe("matrix");
  });

  it("resolves pyramid layout", () => {
    expect(parser.resolveLayoutCategory("pyramidList")).toBe("pyramid");
  });

  it("resolves relationship (venn) layout", () => {
    expect(parser.resolveLayoutCategory("basicVenn")).toBe("relationship");
  });

  it("resolves funnel layout", () => {
    expect(parser.resolveLayoutCategory("funnelChart")).toBe("funnel");
  });

  it("resolves timeline layout", () => {
    expect(parser.resolveLayoutCategory("basicTimeline")).toBe("timeline");
  });

  it("defaults to list for unknown layout names", () => {
    expect(parser.resolveLayoutCategory("someUnknownLayout")).toBe("list");
    expect(parser.resolveLayoutCategory("")).toBe("list");
    expect(parser.resolveLayoutCategory(undefined)).toBe("list");
  });
});

// ---------------------------------------------------------------------------
// Node text extraction
// ---------------------------------------------------------------------------

describe("PptxSmartArtParser — node text extraction", () => {
  const parser = new PptxSmartArtParser();

  it("extracts text from SmartArt point nodes", () => {
    const dataModel: XmlObject = {
      "dgm:ptLst": {
        "dgm:pt": [
          {
            "@_modelId": "1",
            "dgm:t": {
              "a:p": { "a:r": { "a:t": "CEO" } },
            },
          },
          {
            "@_modelId": "2",
            "dgm:t": {
              "a:p": { "a:r": { "a:t": "VP Marketing" } },
            },
          },
        ],
      },
    };

    const nodes = parser.parseNodes(dataModel, xmlLookupService);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].text).toBe("CEO");
    expect(nodes[0].id).toBe("1");
    expect(nodes[1].text).toBe("VP Marketing");
    expect(nodes[1].id).toBe("2");
  });

  it("skips points without text content", () => {
    const dataModel: XmlObject = {
      "dgm:ptLst": {
        "dgm:pt": [
          {
            "@_modelId": "1",
            "@_type": "doc",
            // No dgm:t element
          },
          {
            "@_modelId": "2",
            "dgm:t": {
              "a:p": { "a:r": { "a:t": "Has text" } },
            },
          },
        ],
      },
    };

    const nodes = parser.parseNodes(dataModel, xmlLookupService);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("Has text");
  });

  it("skips points without model ID", () => {
    const dataModel: XmlObject = {
      "dgm:ptLst": {
        "dgm:pt": {
          // Missing @_modelId
          "dgm:t": {
            "a:p": { "a:r": { "a:t": "No ID" } },
          },
        },
      },
    };

    const nodes = parser.parseNodes(dataModel, xmlLookupService);
    expect(nodes).toHaveLength(0);
  });

  it("preserves nodeType attribute", () => {
    const dataModel: XmlObject = {
      "dgm:ptLst": {
        "dgm:pt": {
          "@_modelId": "1",
          "@_type": "asst",
          "dgm:t": {
            "a:p": { "a:r": { "a:t": "Assistant" } },
          },
        },
      },
    };

    const nodes = parser.parseNodes(dataModel, xmlLookupService);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeType).toBe("asst");
  });

  it("returns empty array when dataModel is undefined", () => {
    const nodes = parser.parseNodes(undefined, xmlLookupService);
    expect(nodes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Connection / parent-child relationship parsing
// ---------------------------------------------------------------------------

describe("PptxSmartArtParser — connections and parent-child relationships", () => {
  const parser = new PptxSmartArtParser();

  it("parses connections from cxnLst", () => {
    const dataModel: XmlObject = {
      "dgm:cxnLst": {
        "dgm:cxn": [
          {
            "@_srcId": "0",
            "@_destId": "1",
            "@_type": "parOf",
            "@_srcOrd": "0",
            "@_destOrd": "0",
          },
          {
            "@_srcId": "0",
            "@_destId": "2",
            "@_type": "parOf",
            "@_srcOrd": "1",
            "@_destOrd": "0",
          },
        ],
      },
    };

    const { connections, parentMap } = parser.parseConnections(
      dataModel,
      xmlLookupService,
    );

    expect(connections).toHaveLength(2);
    expect(connections[0]).toEqual({
      sourceId: "0",
      destId: "1",
      type: "parOf",
      srcOrd: 0,
      destOrd: 0,
    });
    expect(connections[1].sourceId).toBe("0");
    expect(connections[1].destId).toBe("2");

    expect(parentMap.get("1")).toBe("0");
    expect(parentMap.get("2")).toBe("0");
  });

  it("skips connections with missing source or destination ID", () => {
    const dataModel: XmlObject = {
      "dgm:cxnLst": {
        "dgm:cxn": [
          { "@_srcId": "", "@_destId": "1" },
          { "@_srcId": "0", "@_destId": "" },
          { "@_srcId": "0", "@_destId": "3", "@_type": "parOf" },
        ],
      },
    };

    const { connections } = parser.parseConnections(
      dataModel,
      xmlLookupService,
    );
    expect(connections).toHaveLength(1);
    expect(connections[0].destId).toBe("3");
  });

  it("returns empty results when dataModel is undefined", () => {
    const { connections, parentMap } = parser.parseConnections(
      undefined,
      xmlLookupService,
    );
    expect(connections).toEqual([]);
    expect(parentMap.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Node tree building
// ---------------------------------------------------------------------------

describe("PptxSmartArtParser — node tree building", () => {
  const parser = new PptxSmartArtParser();

  it("builds parent-child relationships from parentMap", () => {
    const nodes = [
      { id: "0", text: "Root" },
      { id: "1", text: "Child A" },
      { id: "2", text: "Child B" },
    ];
    const parentMap = new Map([
      ["1", "0"],
      ["2", "0"],
    ]);

    const result = parser.buildNodeTree(nodes, parentMap);

    expect(result[0].children).toHaveLength(2);
    expect(result[0].children![0].text).toBe("Child A");
    expect(result[0].children![1].text).toBe("Child B");
    expect(result[1].parentId).toBe("0");
    expect(result[2].parentId).toBe("0");
    expect(result[0].parentId).toBeUndefined();
  });

  it("handles nodes with no parent gracefully", () => {
    const nodes = [
      { id: "0", text: "Standalone" },
    ];
    const parentMap = new Map<string, string>();

    const result = parser.buildNodeTree(nodes, parentMap);
    expect(result[0].parentId).toBeUndefined();
    expect(result[0].children).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// assembleSmartArtData
// ---------------------------------------------------------------------------

describe("PptxSmartArtParser — assembleSmartArtData", () => {
  const parser = new PptxSmartArtParser();

  it("assembles complete SmartArt data with resolved layout", () => {
    const result = parser.assembleSmartArtData({
      nodes: [
        { id: "1", text: "Step 1" },
        { id: "2", text: "Step 2" },
      ],
      connections: [
        { sourceId: "1", destId: "2", type: "parOf" },
      ],
      layoutType: "basicProcess",
      dataRelId: "rId1",
      drawingRelId: "rId2",
      colorsRelId: "rId3",
      styleRelId: "rId4",
    });

    expect(result).toBeDefined();
    expect(result!.resolvedLayoutType).toBe("process");
    expect(result!.layoutType).toBe("basicProcess");
    expect(result!.nodes).toHaveLength(2);
    expect(result!.connections).toHaveLength(1);
    expect(result!.dataRelId).toBe("rId1");
    expect(result!.drawingRelId).toBe("rId2");
  });

  it("returns undefined when nodes array is empty", () => {
    const result = parser.assembleSmartArtData({
      nodes: [],
      connections: [],
    });
    expect(result).toBeUndefined();
  });

  it("omits connections when array is empty", () => {
    const result = parser.assembleSmartArtData({
      nodes: [{ id: "1", text: "Solo" }],
      connections: [],
    });
    expect(result).toBeDefined();
    expect(result!.connections).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Smart art text helpers (pure functions)
// ---------------------------------------------------------------------------

describe("smart-art-text-helpers — getLocalName", () => {
  it("strips namespace prefix", () => {
    expect(getLocalName("dgm:pt")).toBe("pt");
    expect(getLocalName("a:p")).toBe("p");
    expect(getLocalName("p14:transition")).toBe("transition");
  });

  it("returns name as-is when no prefix", () => {
    expect(getLocalName("element")).toBe("element");
    expect(getLocalName("")).toBe("");
  });
});

describe("smart-art-text-helpers — extractTextFromPoint", () => {
  it("extracts text from DrawingML paragraph structure", () => {
    const point: XmlObject = {
      "@_modelId": "1",
      "dgm:t": {
        "a:p": {
          "a:r": { "a:t": "Hello World" },
        },
      },
    };

    const text = extractTextFromPoint(point);
    expect(text).toBe("Hello World");
  });

  it("returns undefined when no text is found", () => {
    const point: XmlObject = {
      "@_modelId": "1",
    };

    const text = extractTextFromPoint(point);
    expect(text).toBeUndefined();
  });

  it("extracts text from multiple runs", () => {
    const point: XmlObject = {
      "@_modelId": "1",
      "dgm:t": {
        "a:p": {
          "a:r": [
            { "a:t": "Part A " },
            { "a:t": "Part B" },
          ],
        },
      },
    };

    const text = extractTextFromPoint(point);
    expect(text).toBe("Part A");
  });

  it("trims whitespace from extracted text", () => {
    const point: XmlObject = {
      "@_modelId": "1",
      "dgm:t": {
        "a:p": {
          "a:r": { "a:t": "  Trimmed  " },
        },
      },
    };

    const text = extractTextFromPoint(point);
    expect(text).toBe("Trimmed");
  });
});
