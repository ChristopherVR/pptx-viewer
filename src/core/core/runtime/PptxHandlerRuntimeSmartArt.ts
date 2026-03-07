import {
  XmlObject,
  type PptxSmartArtData,
  type PptxSmartArtConnection,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSmartArtParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  public async getSmartArtDataForGraphicFrame(
    slidePath: string,
    graphicFrame: XmlObject | undefined,
  ): Promise<PptxSmartArtData | undefined> {
    const graphicData = this.xmlLookupService.getChildByLocalName(
      this.xmlLookupService.getChildByLocalName(graphicFrame, "graphic"),
      "graphicData",
    );
    const relationshipIds = this.xmlLookupService.getChildByLocalName(
      graphicData,
      "relIds",
    );
    if (!relationshipIds) return undefined;

    const diagramDataRelationshipId = String(
      relationshipIds["@_r:dm"] || "",
    ).trim();
    if (diagramDataRelationshipId.length === 0) return undefined;

    const diagramDataPart = await this.readXmlPartByRelationshipId(
      slidePath,
      diagramDataRelationshipId,
    );
    if (!diagramDataPart) return undefined;

    const dataModel = this.xmlLookupService.getChildByLocalName(
      diagramDataPart.xml,
      "dataModel",
    );
    const pointList = this.xmlLookupService.getChildByLocalName(
      dataModel,
      "ptLst",
    );
    const points = this.xmlLookupService.getChildrenArrayByLocalName(
      pointList,
      "pt",
    );

    // ── Parse connections ────────────────────────────────────────────
    const { parsedConnections, parentByNodeId } =
      this.parseSmartArtConnections(dataModel);

    // ── Parse nodes ──────────────────────────────────────────────────
    const nodes = points
      .map((point) => {
        const pointId = String(point?.["@_modelId"] || "").trim();
        if (pointId.length === 0) return null;

        const nodeType = String(point?.["@_type"] || "").trim() || undefined;
        const textValues: string[] = [];
        this.collectLocalTextValues(point, "t", textValues);
        const resolvedText = textValues.find(
          (entry) => entry.trim().length > 0,
        );
        if (!resolvedText) return null;

        return {
          id: pointId,
          text: resolvedText.trim(),
          parentId: parentByNodeId.get(pointId),
          nodeType,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 50);

    if (nodes.length === 0) return undefined;

    // ── Resolve layout type ──────────────────────────────────────────
    const layoutRelationshipId = String(relationshipIds["@_r:lo"] || "").trim();
    const layoutPart =
      layoutRelationshipId.length > 0
        ? await this.readXmlPartByRelationshipId(
            slidePath,
            layoutRelationshipId,
          )
        : undefined;
    const layoutType =
      layoutPart?.partPath
        ?.split("/")
        .pop()
        ?.replace(/\.[^.]+$/, "") || undefined;

    // ── Parse background (dgm:bg) and outline (dgm:whole) ───────────
    const chrome = this.parseSmartArtChrome(dataModel);

    // ── Parse drawing shapes from ppt/diagrams/drawing*.xml ──────────
    const drawingRelationshipId = String(
      relationshipIds["@_r:cs"] || "",
    ).trim();
    const drawingShapes = await this.parseSmartArtDrawingShapes(
      slidePath,
      drawingRelationshipId,
    );

    // ── Parse color transform from ppt/diagrams/colors*.xml ──────────
    const colorsRelationshipId = String(relationshipIds["@_r:cs"] || "").trim();
    const colorTransform = await this.parseSmartArtColorTransform(
      slidePath,
      colorsRelationshipId,
    );

    // ── Parse quick style from ppt/diagrams/quickStyles*.xml ─────────
    const styleRelationshipId = String(relationshipIds["@_r:qs"] || "").trim();
    const quickStyle = await this.parseSmartArtQuickStyle(
      slidePath,
      styleRelationshipId,
    );

    return {
      layoutType,
      nodes,
      connections: parsedConnections.length > 0 ? parsedConnections : undefined,
      drawingShapes: drawingShapes.length > 0 ? drawingShapes : undefined,
      chrome,
      colorTransform,
      quickStyle,
      dataRelId: diagramDataRelationshipId,
      drawingRelId:
        drawingRelationshipId.length > 0 ? drawingRelationshipId : undefined,
      colorsRelId:
        colorsRelationshipId.length > 0 ? colorsRelationshipId : undefined,
      styleRelId:
        styleRelationshipId.length > 0 ? styleRelationshipId : undefined,
    };
  }

  private parseSmartArtConnections(dataModel: XmlObject | undefined): {
    parsedConnections: PptxSmartArtConnection[];
    parentByNodeId: Map<string, string>;
  } {
    const connectionList = this.xmlLookupService.getChildByLocalName(
      dataModel,
      "cxnLst",
    );
    const rawConnections = this.xmlLookupService.getChildrenArrayByLocalName(
      connectionList,
      "cxn",
    );
    const parentByNodeId = new Map<string, string>();
    const parsedConnections: PptxSmartArtConnection[] = [];

    rawConnections.forEach((connection) => {
      const sourceId = String(connection?.["@_srcId"] || "").trim();
      const destinationId = String(connection?.["@_destId"] || "").trim();
      if (sourceId.length === 0 || destinationId.length === 0) return;
      const connType = String(connection?.["@_type"] || "").trim() || undefined;
      const srcOrdRaw = parseInt(String(connection?.["@_srcOrd"] || ""), 10);
      const destOrdRaw = parseInt(String(connection?.["@_destOrd"] || ""), 10);
      parsedConnections.push({
        sourceId,
        destId: destinationId,
        type: connType,
        srcOrd: Number.isFinite(srcOrdRaw) ? srcOrdRaw : undefined,
        destOrd: Number.isFinite(destOrdRaw) ? destOrdRaw : undefined,
      });
      if (!parentByNodeId.has(destinationId)) {
        parentByNodeId.set(destinationId, sourceId);
      }
    });

    return { parsedConnections, parentByNodeId };
  }
}
