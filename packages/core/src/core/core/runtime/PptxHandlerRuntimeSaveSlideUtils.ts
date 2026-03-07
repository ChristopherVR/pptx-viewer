import {
  PptxSlide,
  XmlObject,
  type PptxElementAnimation,
  type PptxSlideTransition,
  TextStyle,
} from "../../types";
import { type PptxSaveState } from "../builders";
import {
  parseDataUrlToBytes,
  fetchUrlToBytes,
} from "../../utils/data-url-utils";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimePresentationProps";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected createEmptySlideXml(): XmlObject {
    return {
      "p:sld": {
        "@_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "@_xmlns:r":
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "@_xmlns:p":
          "http://schemas.openxmlformats.org/presentationml/2006/main",
        "p:cSld": {
          "p:spTree": {
            "p:nvGrpSpPr": {
              "p:cNvPr": { "@_id": "1", "@_name": "" },
              "p:cNvGrpSpPr": {},
              "p:nvPr": {},
            },
            "p:grpSpPr": {
              "a:xfrm": {
                "a:off": { "@_x": "0", "@_y": "0" },
                "a:ext": { "@_cx": "0", "@_cy": "0" },
                "a:chOff": { "@_x": "0", "@_y": "0" },
                "a:chExt": { "@_cx": "0", "@_cy": "0" },
              },
            },
          },
        },
        "p:clrMapOvr": { "a:masterClrMapping": {} },
      },
    };
  }

  protected deepCloneXml(value: XmlObject | undefined): XmlObject | undefined {
    if (!value) return undefined;
    try {
      return JSON.parse(JSON.stringify(value)) as XmlObject;
    } catch {
      return undefined;
    }
  }

  protected findSourceSlidePath(
    requestedSourcePath: string | undefined,
  ): string | undefined {
    if (
      requestedSourcePath &&
      this.slideMap.has(requestedSourcePath) &&
      requestedSourcePath.startsWith("ppt/slides/slide")
    ) {
      return requestedSourcePath;
    }

    for (const slidePath of this.slideMap.keys()) {
      if (slidePath.startsWith("ppt/slides/slide")) {
        return slidePath;
      }
    }

    return undefined;
  }

  protected async loadSlideRelationships(
    slidePath: string,
    relsPath: string,
  ): Promise<void> {
    const relsXml = await this.zip.file(relsPath)?.async("string");
    if (!relsXml) return;

    const relsData = this.parser.parse(relsXml);
    const relsMap = new Map<string, string>();
    const externalIds = new Set<string>();

    if (relsData?.Relationships?.Relationship) {
      const rels = Array.isArray(relsData.Relationships.Relationship)
        ? relsData.Relationships.Relationship
        : [relsData.Relationships.Relationship];

      rels.forEach((r: XmlObject) => {
        if (r["@_Id"] && r["@_Target"]) {
          const relId = String(r["@_Id"]);
          relsMap.set(relId, String(r["@_Target"]));
          if (String(r["@_TargetMode"] || "").toLowerCase() === "external") {
            externalIds.add(relId);
          }
        }
      });
    }

    this.slideRelsMap.set(slidePath, relsMap);
    if (externalIds.size > 0) {
      this.externalRelsMap.set(slidePath, externalIds);
    }
  }

  protected async reconcilePresentationSlidesForSave(params: {
    slides: PptxSlide[];
    saveSession: PptxSaveState;
    slideRelationshipType: string;
    slideLayoutRelationshipType: string;
    relationshipsNamespace: string;
  }): Promise<void> {
    await this.presentationSlidesReconciler.reconcile({
      ...params,
      zip: this.zip,
      parser: this.parser,
      xmlBuilder: this.builder,
      presentationData: this.presentationData,
      slideMap: this.slideMap,
      slideRelsMap: this.slideRelsMap,
      toPresentationTarget: (slidePath) => this.toPresentationTarget(slidePath),
      toSlidePathFromTarget: (target) => this.toSlidePathFromTarget(target),
      toSlideRelsPath: (slidePath) => this.toSlideRelsPath(slidePath),
      createEmptySlideXml: () => this.createEmptySlideXml(),
      deepCloneXml: (value) => this.deepCloneXml(value),
      findSourceSlidePath: (sourceSlideId) =>
        this.findSourceSlidePath(sourceSlideId),
      loadSlideRelationships: (slidePath, slideRelsPath) =>
        this.loadSlideRelationships(slidePath, slideRelsPath),
    });
  }

  protected buildSlideTransitionXml(
    transition: PptxSlideTransition,
  ): XmlObject | undefined {
    return this.slideTransitionService.buildSlideTransitionXml(transition);
  }

  protected applyEditorAnimations(
    slideNode: XmlObject,
    animations: PptxElementAnimation[],
  ): void {
    this.editorAnimationService.applyEditorAnimations(slideNode, animations);
  }

  protected ensureSlideTree(xmlObj: XmlObject): XmlObject {
    if (!xmlObj["p:sld"]) xmlObj["p:sld"] = {};
    const pSld = xmlObj["p:sld"] as XmlObject;

    if (!pSld["p:cSld"]) pSld["p:cSld"] = {};
    const cSld = pSld["p:cSld"] as XmlObject;

    if (!cSld["p:spTree"]) {
      cSld["p:spTree"] = this.createEmptySlideXml()["p:sld"]["p:cSld"][
        "p:spTree"
      ] as XmlObject;
    }

    pSld["p:cSld"] = cSld;
    xmlObj["p:sld"] = pSld;
    return cSld["p:spTree"] as XmlObject;
  }

  protected parseDataUrlToBytes(
    dataUrl: string,
  ): { bytes: Uint8Array; extension: string } | null {
    return parseDataUrlToBytes(dataUrl);
  }

  /**
   * Resolve media data to bytes from any source:
   * - `data:...;base64,...` — decoded synchronously
   * - `fuzor-resource://...`, `blob:...`, `http(s)://...` — fetched
   */
  protected async resolveMediaToBytes(
    mediaUrl: string,
  ): Promise<{ bytes: Uint8Array; extension: string } | null> {
    // Try base64 data URL first (fast, synchronous)
    const dataResult = parseDataUrlToBytes(mediaUrl);
    if (dataResult) return dataResult;

    // Fall back to fetching the URL (fuzor-resource://, blob:, http(s)://)
    return fetchUrlToBytes(mediaUrl);
  }

  protected textAlignToDrawingValue(
    align: TextStyle["align"] | undefined,
  ): string | undefined {
    if (align === "left") return "l";
    if (align === "center") return "ctr";
    if (align === "right") return "r";
    if (align === "justify") return "just";
    return undefined;
  }

  protected pixelsToPoints(px: number): number {
    return px * (72 / 96);
  }

  protected createParagraphSpacingXmlFromPx(
    spacing: number | undefined,
  ): XmlObject | undefined {
    if (typeof spacing !== "number" || !Number.isFinite(spacing)) {
      return undefined;
    }
    const spacingPoints = Math.max(0, this.pixelsToPoints(spacing));
    return {
      "a:spcPts": {
        "@_val": String(Math.round(spacingPoints * 100)),
      },
    };
  }

  protected createLineSpacingXmlFromMultiplier(
    lineSpacing: number | undefined,
  ): XmlObject | undefined {
    if (typeof lineSpacing !== "number" || !Number.isFinite(lineSpacing)) {
      return undefined;
    }
    const normalized = Math.max(0.1, Math.min(5, lineSpacing));
    return {
      "a:spcPct": {
        "@_val": String(Math.round(normalized * 100000)),
      },
    };
  }
}
