import {
  PptxElement,
  XmlObject,
  type ContentPartPptxElement,
  type MediaPptxElement,
  type PptxTableData,
} from "../../types";
import { type PlaceholderInfo } from "./PptxHandlerRuntimeTypes";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSavePipeline";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse media data (video/audio path and MIME type) from graphic frame data.
   */
  protected parseMediaData(
    graphicData: XmlObject,
    slidePath: string,
  ): Partial<MediaPptxElement> {
    return this.mediaDataParser.parseMediaData(graphicData, slidePath);
  }

  /**
   * Parse table cell data from `a:tbl` XML inside a graphic frame.
   */
  protected parseTableData(graphicData: XmlObject): PptxTableData | undefined {
    return this.tableDataParser.parseTableData(graphicData);
  }

  protected parseGraphicFrame(
    frame: XmlObject,
    id: string,
    slidePath?: string,
  ): PptxElement | null {
    return this.graphicFrameParser.parseGraphicFrame(frame, id, slidePath);
  }

  /**
   * Parse a `p:contentPart` element, typically containing ink strokes
   * from modern PPTX files. The content-part references an external
   * XML file via `@_r:id` which contains ink stroke data.
   */
  protected async parseContentPart(
    contentPart: XmlObject,
    id: string,
    slidePath?: string,
  ): Promise<PptxElement | null> {
    try {
      const rId = String(contentPart?.["@_r:id"] || "").trim();
      const inkStrokes: Array<{
        path: string;
        color: string;
        width: number;
        opacity: number;
      }> = [];
      const xfrm = contentPart["p:xfrm"] as XmlObject | undefined;
      const off = xfrm?.["a:off"] as XmlObject | undefined;
      const ext = xfrm?.["a:ext"] as XmlObject | undefined;

      const rawX = parseInt(String(off?.["@_x"] ?? "0"), 10);
      const rawY = parseInt(String(off?.["@_y"] ?? "0"), 10);
      const rawCx = parseInt(String(ext?.["@_cx"] ?? "0"), 10);
      const rawCy = parseInt(String(ext?.["@_cy"] ?? "0"), 10);

      const x = Number.isFinite(rawX)
        ? rawX / PptxHandlerRuntime.EMU_PER_PX
        : 0;
      const y = Number.isFinite(rawY)
        ? rawY / PptxHandlerRuntime.EMU_PER_PX
        : 0;
      const width =
        Number.isFinite(rawCx) && rawCx > 0
          ? rawCx / PptxHandlerRuntime.EMU_PER_PX
          : 120;
      const height =
        Number.isFinite(rawCy) && rawCy > 0
          ? rawCy / PptxHandlerRuntime.EMU_PER_PX
          : 80;

      // Attempt to resolve and parse the ink XML part
      if (rId && slidePath) {
        const relsMap = this.slideRelsMap.get(slidePath);
        const inkTarget = relsMap?.get(rId);
        if (inkTarget) {
          const inkPath = this.resolveImagePath(slidePath, inkTarget);
          const inkXml = await this.zip.file(inkPath)?.async("string");
          if (inkXml) {
            const inkData = this.parser.parse(inkXml) as XmlObject;
            // Ink XML typically has <ink:ink> root with <ink:trace> children
            const inkRoot = (inkData["ink:ink"] || inkData["ink"]) as
              | XmlObject
              | undefined;
            if (inkRoot) {
              const traces = this.ensureArray(
                inkRoot["ink:trace"] ?? inkRoot["trace"],
              );
              for (const trace of traces) {
                const pathStr =
                  typeof trace === "string"
                    ? trace
                    : String(trace?.["#text"] || trace || "").trim();
                if (pathStr.length > 0) {
                  inkStrokes.push({
                    path: pathStr,
                    color: "#000000",
                    width: 1,
                    opacity: 1,
                  });
                }
              }
            }
          }
        }
      }

      return {
        id,
        type: "contentPart",
        x,
        y,
        width,
        height,
        inkStrokes: inkStrokes.length > 0 ? inkStrokes : undefined,
        rawXml: contentPart,
      } as ContentPartPptxElement;
    } catch (e) {
      console.warn("Skipping malformed content part:", e);
      return null;
    }
  }

  protected parseConnector(
    conn: XmlObject,
    id: string,
    slidePath?: string,
  ): PptxElement | null {
    return this.connectorParser.parseConnector(conn, id, slidePath);
  }

  protected extractPlaceholderInfo(
    node: XmlObject | undefined,
  ): PlaceholderInfo | null {
    if (!node) return null;
    const placeholderNode = node["p:ph"] as XmlObject | undefined;
    if (!placeholderNode) return null;

    const idx = placeholderNode["@_idx"];
    const type = placeholderNode["@_type"];
    const sz = placeholderNode["@_sz"];

    return {
      idx: idx !== undefined ? String(idx) : undefined,
      type: type !== undefined ? String(type).toLowerCase() : undefined,
      sz: sz !== undefined ? String(sz).toLowerCase() : undefined,
    };
  }

  protected placeholderMatches(
    source: PlaceholderInfo | null,
    target: PlaceholderInfo | null,
  ): boolean {
    if (!source && !target) return true;
    if (!target) return false;
    if (!source) return true;

    // Per OOXML spec, idx is the primary key for multi-instance
    // placeholder matching (e.g. content areas 1, 2, 3).
    if (source.idx !== undefined && target.idx !== undefined) {
      if (source.idx !== target.idx) return false;
      // idx matches — if both have types, they must also match
      if (source.type && target.type && source.type !== target.type)
        return false;
      return true;
    }

    // If source has idx but target does not, try matching by type
    // only for well-known singleton types (title, ctrTitle, subTitle,
    // dt, ftr, sldNum). For generic body/obj placeholders the idx
    // mismatch means different instances.
    if (source.idx !== undefined && target.idx === undefined) {
      const singletonTypes = new Set([
        "title",
        "ctrtitle",
        "subtitle",
        "dt",
        "ftr",
        "sldnum",
      ]);
      if (source.type && singletonTypes.has(source.type)) {
        return target.type === source.type;
      }
      return false;
    }

    // Neither has idx — match by type
    if (source.type && target.type && source.type !== target.type) return false;
    if (source.type && !target.type) return false;

    return true;
  }
}
