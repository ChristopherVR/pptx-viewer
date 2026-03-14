import type {
  MediaPptxElement,
  OlePptxElement,
  PptxElement,
  PptxTableData,
  TablePptxElement,
  XmlObject,
} from "../../types";
import {
  detectOleObjectType,
  inferOleExtensionFromTarget,
} from "../../utils/ole-utils";

export interface PptxGraphicFrameParserContext {
  emuPerPx: number;
  getOrderedSlidePaths: () => string[];
  slideRelsMap: Map<string, Map<string, string>>;
  externalRelsMap: Map<string, Set<string>>;
  readFlipState: (xfrm: XmlObject | undefined) => {
    flipHorizontal?: boolean;
    flipVertical?: boolean;
  };
  parseTableData: (graphicData: XmlObject) => PptxTableData | undefined;
  parseMediaData: (
    graphicData: XmlObject,
    slidePath: string,
  ) => Partial<MediaPptxElement>;
  parseElementActions: (
    cNvPr: XmlObject | undefined,
    slideRelationships: Map<string, string> | undefined,
    orderedSlidePaths: string[],
  ) => {
    actionClick?: PptxElement["actionClick"];
    actionHover?: PptxElement["actionHover"];
  };
  inspectGraphicFrameCompatibility: (
    type: PptxElement["type"],
    slidePath: string,
    elementId: string,
  ) => void;
}

export interface IPptxGraphicFrameParser {
  parseGraphicFrame(
    frame: XmlObject,
    id: string,
    slidePath?: string,
  ): PptxElement | null;
  parseGraphicFrameType(
    graphicData: XmlObject | undefined,
  ): PptxElement["type"];
}

export class PptxGraphicFrameParser implements IPptxGraphicFrameParser {
  private readonly context: PptxGraphicFrameParserContext;

  public constructor(context: PptxGraphicFrameParserContext) {
    this.context = context;
  }

  public parseGraphicFrame(
    frame: XmlObject,
    id: string,
    slidePath?: string,
  ): PptxElement | null {
    try {
      const transform = frame["p:xfrm"] as XmlObject | undefined;
      const offset = ((transform?.["a:off"] as XmlObject | undefined) ||
        {}) as XmlObject;
      const extent = ((transform?.["a:ext"] as XmlObject | undefined) ||
        {}) as XmlObject;

      const graphicData = frame["a:graphic"]?.["a:graphicData"] as
        | XmlObject
        | undefined;
      const { flipHorizontal, flipVertical } =
        this.context.readFlipState(transform);

      const type = this.parseGraphicFrameType(graphicData);
      if (slidePath) {
        this.context.inspectGraphicFrameCompatibility(type, slidePath, id);
      }

      const baseElement = {
        id,
        type,
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
        rotation: transform?.["@_rot"]
          ? parseInt(String(transform["@_rot"]), 10) / 60000
          : undefined,
        skewX: transform?.["@_skewX"]
          ? parseInt(String(transform["@_skewX"]), 10) / 60000
          : undefined,
        skewY: transform?.["@_skewY"]
          ? parseInt(String(transform["@_skewY"]), 10) / 60000
          : undefined,
        flipHorizontal,
        flipVertical,
        rawXml: frame,
      };

      if (type === "table" && graphicData) {
        const tableData = this.context.parseTableData(graphicData);
        return { ...baseElement, tableData } as TablePptxElement;
      }

      if (type === "media" && graphicData && slidePath) {
        const mediaInfo = this.context.parseMediaData(graphicData, slidePath);
        return { ...baseElement, ...mediaInfo } as MediaPptxElement;
      }

      if (type === "ole" && graphicData) {
        const oleObject = graphicData["p:oleObj"] as XmlObject | undefined;
        const oleProgId =
          String(oleObject?.["@_progId"] || "").trim() || undefined;
        const oleName = String(oleObject?.["@_name"] || "").trim() || undefined;
        const oleClsId =
          String(oleObject?.["@_classid"] || "").trim() || undefined;
        const isLinked = oleObject?.["@_link"] != null;
        let oleTarget: string | undefined;
        let previewImage: string | undefined;

        const oleRelationshipId = String(
          oleObject?.["@_r:id"] || oleObject?.["@_id"] || "",
        ).trim();
        let externalPath: string | undefined;
        if (oleRelationshipId && slidePath) {
          const relsMap = this.context.slideRelsMap.get(slidePath);
          oleTarget = relsMap?.get(oleRelationshipId);
          // Detect external path for linked OLE objects
          if (isLinked) {
            const externalIds = this.context.externalRelsMap.get(slidePath);
            if (externalIds?.has(oleRelationshipId)) {
              externalPath = oleTarget;
            }
          }
        }

        const olePicture = oleObject?.["p:pic"] as XmlObject | undefined;
        const oleBlipFill = olePicture?.["p:blipFill"] as XmlObject | undefined;
        const oleBlip = oleBlipFill?.["a:blip"] as XmlObject | undefined;
        const previewRelationshipId = String(
          oleBlip?.["@_r:embed"] || "",
        ).trim();
        if (previewRelationshipId && slidePath) {
          const relsMap = this.context.slideRelsMap.get(slidePath);
          previewImage = relsMap?.get(previewRelationshipId);
        }

        // Detect OLE object type from progId / clsId
        const { oleObjectType, oleFileExtension: detectedExt } =
          detectOleObjectType(oleProgId, oleClsId);
        // Prefer extension inferred from the actual oleTarget path
        const targetExt = inferOleExtensionFromTarget(oleTarget);
        const oleFileExtension = targetExt ?? detectedExt;

        const cNvPr = frame?.["p:nvGraphicFramePr"]?.["p:cNvPr"] as
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

        return {
          ...baseElement,
          oleProgId,
          oleName,
          oleClsId,
          oleObjectType,
          oleFileExtension,
          isLinked,
          externalPath,
          oleTarget,
          previewImage,
          actionClick,
          actionHover,
        } as OlePptxElement;
      }

      return baseElement as PptxElement;
    } catch {
      return null;
    }
  }

  public parseGraphicFrameType(
    graphicData: XmlObject | undefined,
  ): PptxElement["type"] {
    if (!graphicData) return "unknown";

    const uri = String(graphicData["@_uri"] || "").toLowerCase();
    if (graphicData["a:tbl"] || uri.includes("/drawingml/2006/table")) {
      return "table";
    }
    if (graphicData["c:chart"] || uri.includes("/drawingml/2006/chart")) {
      return "chart";
    }
    if (graphicData["dgm:relIds"] || uri.includes("/drawingml/2006/diagram")) {
      return "smartArt";
    }
    if (graphicData["p:oleObj"] || uri.includes("/drawingml/2006/ole")) {
      return "ole";
    }
    if (
      graphicData["a:videoFile"] ||
      graphicData["a:audioFile"] ||
      uri.includes("/drawingml/2006/media")
    ) {
      return "media";
    }
    return "unknown";
  }
}
