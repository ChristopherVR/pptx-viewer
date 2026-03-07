import type {
  PptxSmartArtNode,
  PptxSmartArtConnection,
  PptxSmartArtData,
  SmartArtLayoutType,
  XmlObject,
} from "../../types";
import { extractTextFromPoint } from "./smart-art-text-helpers";

/**
 * Parser for SmartArt DiagramML data structures.
 *
 * Extracts nodes, connections, text content, and layout information from
 * PowerPoint DiagramML XML parts (`ppt/diagrams/data*.xml`, `layout*.xml`, etc.).
 *
 * Phase 1 Implementation:
 * - Parse basic node structure from `dgm:dataModel` / `dgm:ptLst`
 * - Extract text content from `dgm:t`
 * - Parse connections from `dgm:cxnLst`
 * - Identify layout type from layout part
 * - Build hierarchical tree structure from flat node list
 *
 * Future Phases:
 * - Parse layout algorithms (Phase 2)
 * - Parse style constraints (Phase 2)
 * - Parse color/style definitions (Phase 2)
 */
export class PptxSmartArtParser {
  /**
   * Parse SmartArt nodes from the diagram data model.
   *
   * Extracts point list (`dgm:ptLst`) and converts each point (`dgm:pt`)
   * into a standardized node structure with ID, text, and type.
   *
   * @param dataModel The `dgm:dataModel` XML object
   * @param xmlLookupService Service for XML traversal
   * @returns Array of parsed SmartArt nodes
   */
  public parseNodes(
    dataModel: XmlObject | undefined,
    xmlLookupService: {
      getChildByLocalName: (
        obj: XmlObject | undefined,
        name: string,
      ) => XmlObject | undefined;
      getChildrenArrayByLocalName: (
        obj: XmlObject | undefined,
        name: string,
      ) => XmlObject[];
    },
  ): PptxSmartArtNode[] {
    if (!dataModel) return [];

    const pointList = xmlLookupService.getChildByLocalName(dataModel, "ptLst");
    const points = xmlLookupService.getChildrenArrayByLocalName(
      pointList,
      "pt",
    );

    const nodes: PptxSmartArtNode[] = [];

    for (const point of points) {
      const pointId = String(point?.["@_modelId"] || "").trim();
      if (pointId.length === 0) continue;

      const nodeType = String(point?.["@_type"] || "").trim() || undefined;

      // Extract text from dgm:t element
      const text = extractTextFromPoint(point);
      if (!text) continue;

      nodes.push({
        id: pointId,
        text: text.trim(),
        nodeType,
      });
    }

    return nodes.slice(0, 50); // Limit for safety
  }

  /**
   * Parse connections between SmartArt nodes.
   *
   * Extracts connection list (`dgm:cxnLst`) and parses each connection (`dgm:cxn`)
   * to build parent-child relationships and ordering information.
   *
   * @param dataModel The `dgm:dataModel` XML object
   * @param xmlLookupService Service for XML traversal
   * @returns Array of parsed connections and a map of node ID to parent ID
   */
  public parseConnections(
    dataModel: XmlObject | undefined,
    xmlLookupService: {
      getChildByLocalName: (
        obj: XmlObject | undefined,
        name: string,
      ) => XmlObject | undefined;
      getChildrenArrayByLocalName: (
        obj: XmlObject | undefined,
        name: string,
      ) => XmlObject[];
    },
  ): {
    connections: PptxSmartArtConnection[];
    parentMap: Map<string, string>;
  } {
    const connections: PptxSmartArtConnection[] = [];
    const parentMap = new Map<string, string>();

    if (!dataModel) {
      return { connections, parentMap };
    }

    const connectionList = xmlLookupService.getChildByLocalName(
      dataModel,
      "cxnLst",
    );
    const rawConnections = xmlLookupService.getChildrenArrayByLocalName(
      connectionList,
      "cxn",
    );

    for (const connection of rawConnections) {
      const sourceId = String(connection?.["@_srcId"] || "").trim();
      const destinationId = String(connection?.["@_destId"] || "").trim();

      if (sourceId.length === 0 || destinationId.length === 0) continue;

      const connType = String(connection?.["@_type"] || "").trim() || undefined;
      const srcOrdRaw = parseInt(String(connection?.["@_srcOrd"] || ""), 10);
      const destOrdRaw = parseInt(String(connection?.["@_destOrd"] || ""), 10);

      connections.push({
        sourceId,
        destId: destinationId,
        type: connType,
        srcOrd: Number.isFinite(srcOrdRaw) ? srcOrdRaw : undefined,
        destOrd: Number.isFinite(destOrdRaw) ? destOrdRaw : undefined,
      });

      // Build parent map for hierarchy construction
      if (!parentMap.has(destinationId)) {
        parentMap.set(destinationId, sourceId);
      }
    }

    return { connections, parentMap };
  }

  /**
   * Build hierarchical tree structure from flat node list using connections.
   *
   * Assigns `parentId` and `children` properties to nodes based on
   * connection relationships.
   *
   * @param nodes Flat array of SmartArt nodes
   * @param parentMap Map of node ID to parent ID
   * @returns Nodes with parent-child relationships established
   */
  public buildNodeTree(
    nodes: PptxSmartArtNode[],
    parentMap: Map<string, string>,
  ): PptxSmartArtNode[] {
    // Assign parent IDs
    const nodeMap = new Map<string, PptxSmartArtNode>();
    for (const node of nodes) {
      node.parentId = parentMap.get(node.id);
      node.children = [];
      nodeMap.set(node.id, node);
    }

    // Build children arrays
    for (const node of nodes) {
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      }
    }

    return nodes;
  }

  /**
   * Resolve the SmartArt layout category from layout type string.
   *
   * Maps PowerPoint layout names (e.g., "layout1", "hierarchy1")
   * to standardized layout categories (hierarchy, process, cycle, etc.).
   *
   * Phase 1: Basic heuristic mapping
   * Phase 2: Full layout algorithm parsing
   *
   * @param layoutType Raw layout type string from layout part filename
   * @returns Resolved layout category
   */
  public resolveLayoutCategory(
    layoutType: string | undefined,
  ): SmartArtLayoutType {
    if (!layoutType) return "list";

    const lower = layoutType.toLowerCase();

    // Hierarchy / Org chart
    if (lower.includes("hier") || lower.includes("org")) return "hierarchy";

    // Process / Flow
    if (lower.includes("process") || lower.includes("flow")) return "process";

    // Cycle / Circular
    if (lower.includes("cycle") || lower.includes("circular")) return "cycle";

    // Matrix / Grid
    if (lower.includes("matrix") || lower.includes("grid")) return "matrix";

    // Pyramid
    if (lower.includes("pyramid")) return "pyramid";

    // Venn
    if (lower.includes("venn")) return "relationship";

    // Funnel
    if (lower.includes("funnel")) return "funnel";

    // Timeline
    if (lower.includes("timeline")) return "timeline";

    // Default to list
    return "list";
  }

  /**
   * Create a complete SmartArt data structure from parsed components.
   *
   * Combines nodes, connections, layout type, and other parsed data
   * into a unified `PptxSmartArtData` object.
   *
   * @param options All parsed SmartArt components
   * @returns Complete SmartArt data structure
   */
  public assembleSmartArtData(options: {
    nodes: PptxSmartArtNode[];
    connections: PptxSmartArtConnection[];
    layoutType?: string;
    dataRelId?: string;
    drawingRelId?: string;
    colorsRelId?: string;
    styleRelId?: string;
  }): PptxSmartArtData | undefined {
    if (options.nodes.length === 0) return undefined;

    const resolvedLayoutType = this.resolveLayoutCategory(options.layoutType);

    return {
      layoutType: options.layoutType,
      resolvedLayoutType,
      nodes: options.nodes,
      connections:
        options.connections.length > 0 ? options.connections : undefined,
      dataRelId: options.dataRelId,
      drawingRelId: options.drawingRelId,
      colorsRelId: options.colorsRelId,
      styleRelId: options.styleRelId,
    };
  }
}

export {
  extractTextFromPoint,
  collectLocalTextValues,
  extractParagraphText,
  getLocalName,
} from "./smart-art-text-helpers";
