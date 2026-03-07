import {
  type XmlObject,
  type PptxElement,
  type PptxSlide,
  hasShapeProperties,
  type MediaPptxElement,
  type PptxImageLikeElement,
  type TablePptxElement,
  type SmartArtPptxElement,
  type ShapePptxElement,
  type ImagePptxElement,
  type PicturePptxElement,
} from "../../types";
import {
  type PptxSaveState,
  type IPptxSlideRelationshipRegistry,
} from "../builders";
import { customGeometryPathsToXml } from "../../geometry/custom-geometry";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveTextWriter";

/** Context passed to per-element save processing. */
export interface SaveSlideContext {
  readonly slide: PptxSlide;
  readonly slideRelationships: XmlObject[];
  readonly slideRelationshipRegistry: IPptxSlideRelationshipRegistry;
  readonly resolveHyperlinkRelationshipId: (
    target: string,
  ) => string | undefined;
  readonly getSlideRelationshipMap: () => Map<string, string>;
  readonly resolvedMediaBytes: Map<
    string,
    { bytes: Uint8Array; extension: string }
  >;
  readonly saveSession: PptxSaveState;
  readonly slideImageRelationshipType: string;
  readonly slideMediaRelationshipType: string;
  readonly slideVideoRelationshipType: string;
  readonly slideAudioRelationshipType: string;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /** Serialize table, chart, and SmartArt data when applicable. */
  protected applyDataSerialization(
    shape: XmlObject,
    el: PptxElement,
    slideId: string,
  ): void {
    if (
      el.type === "table" &&
      "tableData" in el &&
      (el as TablePptxElement).tableData
    ) {
      this.serializeTableDataToXml(shape, (el as TablePptxElement).tableData!);
    }
    if (el.type === "chart" && "chartData" in el && el.chartData) {
      this.serializeChartDataToXml(el.chartData, slideId);
    }
    if (el.type === "smartArt" && "smartArtData" in el) {
      const saEl = el as SmartArtPptxElement;
      if (saEl.smartArtData?.dataRelId) {
        this.serializeSmartArtDataToXml(saEl, slideId);
      }
    }
  }

  /** Apply image crop, effects, and alt text for picture/image elements. */
  protected applyImageProperties(shape: XmlObject, el: PptxElement): void {
    if (el.type !== "picture" && el.type !== "image") return;
    const pictureBlipFill =
      (shape["p:blipFill"] as XmlObject | undefined) ||
      ((shape["p:spPr"] as XmlObject | undefined)?.["a:blipFill"] as
        | XmlObject
        | undefined);
    this.applyImageCropToBlipFill(pictureBlipFill, el);
    this.applyImageEffectsToBlip(pictureBlipFill, el.imageEffects);
    const cNvPrNode = shape?.["p:nvPicPr"]?.["p:cNvPr"] as
      | XmlObject
      | undefined;
    if (cNvPrNode) {
      const altText = String((el as PptxImageLikeElement).altText || "").trim();
      if (altText.length > 0) {
        cNvPrNode["@_descr"] = altText;
      } else {
        delete cNvPrNode["@_descr"];
      }
    }
  }

  /** Apply geometry preset or custom paths to spPr. */
  protected applyGeometryUpdate(shape: XmlObject, el: PptxElement): void {
    if (!hasShapeProperties(el) || !shape["p:spPr"]) return;
    const spPr = shape["p:spPr"] as XmlObject;
    const elWithPaths = el as
      | ShapePptxElement
      | ImagePptxElement
      | PicturePptxElement;
    if (
      elWithPaths.customGeometryPaths &&
      elWithPaths.customGeometryPaths.length > 0
    ) {
      delete spPr["a:prstGeom"];
      spPr["a:custGeom"] = customGeometryPathsToXml(
        elWithPaths.customGeometryPaths,
      );
    } else if (spPr["a:prstGeom"]) {
      const presetGeometry =
        el.type === "connector"
          ? this.normalizePresetGeometry(el.shapeType || "straightConnector1")
          : this.normalizePresetGeometry(el.shapeType);
      const prstGeom = spPr["a:prstGeom"] as XmlObject;
      prstGeom["@_prst"] = presetGeometry;
      if (el.shapeAdjustments) {
        const entries = Object.entries(el.shapeAdjustments).filter(
          ([name, value]) => name.trim().length > 0 && Number.isFinite(value),
        );
        if (entries.length > 0) {
          prstGeom["a:avLst"] = {
            "a:gd": entries.map(([name, value]) => ({
              "@_name": name,
              "@_fmla": `val ${Math.round(value)}`,
            })),
          };
        } else if (!prstGeom["a:avLst"]) {
          prstGeom["a:avLst"] = {};
        }
      } else if (!prstGeom["a:avLst"]) {
        prstGeom["a:avLst"] = {};
      }
    }
  }

  /** Embed image data and create relationships for picture/image elements. */
  protected processImageEmbedding(
    el: PptxImageLikeElement,
    shape: XmlObject | undefined,
    ctx: SaveSlideContext,
  ): XmlObject | undefined {
    const parsedImage = this.parseDataUrlToBytes(el.imageData!);
    if (parsedImage) {
      let targetImagePath = el.imagePath;
      if (!targetImagePath) {
        targetImagePath = ctx.saveSession.nextMediaPath(parsedImage.extension);
        const relationshipId =
          ctx.slideRelationshipRegistry.nextRelationshipId();
        const relativeMediaPath = targetImagePath.replace(/^ppt\//, "../");
        ctx.slideRelationships.push({
          "@_Id": relationshipId,
          "@_Type": ctx.slideImageRelationshipType,
          "@_Target": relativeMediaPath,
        });
        shape = this.createPictureXml(el, relationshipId);
      }
      if (targetImagePath) {
        this.zip.file(targetImagePath, parsedImage.bytes);
      }
    } else {
      this.compatibilityService.reportWarning({
        code: "SAVE_IMAGE_PAYLOAD_UNSUPPORTED",
        message:
          "Image payload could not be converted to an embedded media part. Original image linkage was preserved when possible.",
        scope: "save",
        slideId: ctx.slide.id,
        elementId: el.id,
      });
    }
    return shape;
  }

  /** Embed media data and manage relationships for media elements. */
  protected processMediaEmbedding(
    mediaElement: MediaPptxElement,
    shape: XmlObject | undefined,
    ctx: SaveSlideContext,
  ): XmlObject | undefined {
    const mediaType = mediaElement.mediaType === "audio" ? "audio" : "video";
    let mediaRelationshipId =
      this.slideMediaRelationshipBuilder.getMediaRelationshipIdFromShape(shape);
    const relTypes = {
      media: ctx.slideMediaRelationshipType,
      video: ctx.slideVideoRelationshipType,
      audio: ctx.slideAudioRelationshipType,
    };

    if (typeof mediaElement.mediaData === "string") {
      const parsedMedia =
        ctx.resolvedMediaBytes.get(mediaElement.id) ??
        this.parseDataUrlToBytes(mediaElement.mediaData);
      if (parsedMedia) {
        let targetMediaPath = mediaElement.mediaPath;
        if (!targetMediaPath) {
          targetMediaPath = ctx.saveSession.nextMediaPath(
            parsedMedia.extension,
            mediaType,
          );
        }
        this.zip.file(targetMediaPath, parsedMedia.bytes);
        const relationshipTarget = targetMediaPath.replace(/^ppt\//, "../");
        if (!mediaRelationshipId) {
          mediaRelationshipId =
            ctx.slideRelationshipRegistry.nextRelationshipId();
        }
        ctx.slideRelationshipRegistry.upsertRelationship(
          mediaRelationshipId,
          this.slideMediaRelationshipBuilder.resolveMediaRelationshipType(
            mediaType,
            relTypes,
          ),
          relationshipTarget,
        );
        if (!shape) {
          shape = this.createMediaGraphicFrameXml(
            mediaElement,
            mediaRelationshipId,
          );
        } else {
          this.slideMediaRelationshipBuilder.ensureGraphicFrameMediaReference(
            shape,
            mediaType,
            mediaRelationshipId,
          );
        }
        mediaElement.mediaPath = targetMediaPath;
        mediaElement.mediaMimeType =
          this.getMediaMimeType(targetMediaPath) || mediaElement.mediaMimeType;
      } else {
        this.compatibilityService.reportWarning({
          code: "SAVE_MEDIA_PAYLOAD_UNSUPPORTED",
          message:
            "Media payload could not be converted to an embedded media part. Original media linkage was preserved when possible.",
          scope: "save",
          slideId: ctx.slide.id,
          elementId: mediaElement.id,
        });
      }
    } else if (
      !shape &&
      typeof mediaElement.mediaPath === "string" &&
      mediaElement.mediaPath.length > 0
    ) {
      const relationshipTarget = mediaElement.mediaPath.replace(
        /^ppt\//,
        "../",
      );
      mediaRelationshipId =
        mediaRelationshipId ||
        ctx.slideRelationshipRegistry.nextRelationshipId();
      ctx.slideRelationshipRegistry.upsertRelationship(
        mediaRelationshipId,
        this.slideMediaRelationshipBuilder.resolveMediaRelationshipType(
          mediaType,
          relTypes,
        ),
        relationshipTarget,
      );
      shape = this.createMediaGraphicFrameXml(
        mediaElement,
        mediaRelationshipId,
      );
    }
    return shape;
  }
}
