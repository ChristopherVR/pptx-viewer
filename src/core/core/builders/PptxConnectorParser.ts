import type {
  ConnectorConnectionPoint,
  PptxElement,
  ShapeStyle,
  TextSegment,
  TextStyle,
  XmlObject,
} from "../../types";

export interface ConnectorTextResult {
  text: string;
  textStyle: TextStyle;
  textSegments: TextSegment[];
}

export interface PptxConnectorParserContext {
  emuPerPx: number;
  getOrderedSlidePaths: () => string[];
  slideRelsMap: Map<string, Map<string, string>>;
  parseGeometryAdjustments: (
    prstGeom: XmlObject | undefined,
  ) => Record<string, number> | undefined;
  readFlipState: (xfrm: XmlObject | undefined) => {
    flipHorizontal?: boolean;
    flipVertical?: boolean;
  };
  extractShapeStyle: (
    spPr: XmlObject | undefined,
    styleNode?: XmlObject,
  ) => ShapeStyle;
  parseShapeLocks: (spLocks: XmlObject | undefined) => PptxElement["locks"];
  parseElementActions: (
    cNvPr: XmlObject | undefined,
    slideRelationships: Map<string, string> | undefined,
    orderedSlidePaths: string[],
  ) => {
    actionClick?: PptxElement["actionClick"];
    actionHover?: PptxElement["actionHover"];
  };
  /** Parse text body XML into text, style, and segments. */
  parseConnectorTextBody?: (
    txBody: XmlObject | undefined,
    slidePath?: string,
  ) => ConnectorTextResult | null;
}

export interface IPptxConnectorParser {
  parseConnector(
    connector: XmlObject,
    id: string,
    slidePath?: string,
  ): PptxElement | null;
}

export class PptxConnectorParser implements IPptxConnectorParser {
  private readonly context: PptxConnectorParserContext;

  public constructor(context: PptxConnectorParserContext) {
    this.context = context;
  }

  public parseConnector(
    connector: XmlObject,
    id: string,
    slidePath?: string,
  ): PptxElement | null {
    try {
      const shapeProperties = connector["p:spPr"] as XmlObject | undefined;
      const transform = shapeProperties?.["a:xfrm"] as XmlObject | undefined;
      if (!transform) return null;

      const offset = transform["a:off"] as XmlObject | undefined;
      const extent = transform["a:ext"] as XmlObject | undefined;
      if (!offset || !extent) return null;

      const shapeType = String(
        shapeProperties?.["a:prstGeom"]?.["@_prst"] || "straightConnector1",
      );
      const shapeAdjustments = this.context.parseGeometryAdjustments(
        shapeProperties?.["a:prstGeom"] as XmlObject | undefined,
      );
      const rotation = transform["@_rot"]
        ? parseInt(String(transform["@_rot"]), 10) / 60000
        : undefined;
      const { flipHorizontal, flipVertical } =
        this.context.readFlipState(transform);

      const cNvConnectionShapeProperties = connector?.["p:nvCxnSpPr"]?.[
        "p:cNvCxnSpPr"
      ] as XmlObject | undefined;
      const shapeStyle = this.context.extractShapeStyle(shapeProperties);

      const startConnectionNode = cNvConnectionShapeProperties?.["a:stCxn"] as
        | XmlObject
        | undefined;
      if (startConnectionNode) {
        const startConnection: ConnectorConnectionPoint = {};
        if (startConnectionNode["@_id"]) {
          startConnection.shapeId = String(startConnectionNode["@_id"]);
        }
        if (startConnectionNode["@_idx"] !== undefined) {
          startConnection.connectionSiteIndex = parseInt(
            String(startConnectionNode["@_idx"]),
            10,
          );
        }
        if (shapeStyle) {
          shapeStyle.connectorStartConnection = startConnection;
        }
      }

      const endConnectionNode = cNvConnectionShapeProperties?.["a:endCxn"] as
        | XmlObject
        | undefined;
      if (endConnectionNode) {
        const endConnection: ConnectorConnectionPoint = {};
        if (endConnectionNode["@_id"]) {
          endConnection.shapeId = String(endConnectionNode["@_id"]);
        }
        if (endConnectionNode["@_idx"] !== undefined) {
          endConnection.connectionSiteIndex = parseInt(
            String(endConnectionNode["@_idx"]),
            10,
          );
        }
        if (shapeStyle) {
          shapeStyle.connectorEndConnection = endConnection;
        }
      }

      const cNvPr = connector?.["p:nvCxnSpPr"]?.["p:cNvPr"] as
        | XmlObject
        | undefined;
      const slideRelationships = slidePath
        ? this.context.slideRelsMap.get(slidePath)
        : undefined;
      const { actionClick, actionHover } = this.context.parseElementActions(
        cNvPr,
        slideRelationships,
        this.context.getOrderedSlidePaths(),
      );

      const locks = this.context.parseShapeLocks(
        (cNvConnectionShapeProperties?.["a:cxnSpLocks"] ??
          cNvConnectionShapeProperties?.["a:spLocks"]) as XmlObject | undefined,
      );

      // Parse connector text body (a:txBody within p:cxnSp)
      const txBody = connector["p:txBody"] as XmlObject | undefined;
      const textResult = this.context.parseConnectorTextBody?.(
        txBody,
        slidePath,
      );

      return {
        id,
        type: "connector",
        x: Math.round(
          parseInt(String(offset["@_x"] || "0"), 10) / this.context.emuPerPx,
        ),
        y: Math.round(
          parseInt(String(offset["@_y"] || "0"), 10) / this.context.emuPerPx,
        ),
        width: Math.round(
          parseInt(String(extent["@_cx"] || "0"), 10) / this.context.emuPerPx,
        ),
        height: Math.round(
          parseInt(String(extent["@_cy"] || "0"), 10) / this.context.emuPerPx,
        ),
        shapeType,
        shapeAdjustments,
        rotation,
        flipHorizontal,
        flipVertical,
        shapeStyle,
        rawXml: connector,
        actionClick,
        actionHover,
        locks,
        ...(textResult
          ? {
              text: textResult.text,
              textStyle: textResult.textStyle,
              textSegments: textResult.textSegments,
            }
          : {}),
      };
    } catch {
      return null;
    }
  }
}
