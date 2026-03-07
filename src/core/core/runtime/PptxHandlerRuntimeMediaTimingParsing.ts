import { XmlObject } from "../../types";
import { type MediaTimingData } from "./PptxHandlerRuntimeImageEffects";
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeImageEffects";
import {
  getXmlShapeIdFromXml,
  getPathExtensionFromPath,
  getImageMimeTypeFromPath,
  parseCtnMediaTiming,
  parseMediaExtensionData,
} from "./PptxHandlerRuntimeMediaParsingUtils";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Recursively walk the timing tree looking for `p:video` and `p:audio`
   * nodes that contain `p:cMediaNode`.
   */
  protected walkMediaTimingTree(
    node: XmlObject,
    result: Map<string, MediaTimingData>,
    slidePath: string,
  ): void {
    if (!node) return;

    // Check for p:video and p:audio nodes at this level
    for (const mediaTag of ["p:video", "p:audio"]) {
      const mediaNodes = this.ensureArray(node[mediaTag]);
      for (const mediaNode of mediaNodes) {
        const cMediaNode = mediaNode["p:cMediaNode"] as XmlObject | undefined;
        if (!cMediaNode) continue;

        // Extract target shape ID
        const tgtEl = cMediaNode["p:tgtEl"] as XmlObject | undefined;
        const spTgt = tgtEl?.["p:spTgt"] as XmlObject | undefined;
        const shapeId = spTgt?.["@_spid"] ? String(spTgt["@_spid"]) : undefined;
        if (!shapeId) continue;

        // Extract timing from p:cTn
        const cTn = cMediaNode["p:cTn"] as XmlObject | undefined;
        const timing = parseCtnMediaTiming(cTn, mediaTag);

        // Full-screen flag
        const fullScreen =
          cMediaNode["@_fullScrn"] === "1" || cMediaNode["@_fullScrn"] === true;

        // Volume (0-100000 in OOXML, maps to 0-1)
        let volume: number | undefined;
        const volRaw = cMediaNode["@_vol"];
        if (volRaw !== undefined) {
          const volVal = parseInt(String(volRaw));
          if (Number.isFinite(volVal)) {
            volume = Math.max(0, Math.min(1, volVal / 100000));
          }
        }

        // Hide-when-not-playing
        const hideWhenNotPlaying =
          cMediaNode["@_showWhenStopped"] === "0" ||
          cMediaNode["@_showWhenStopped"] === false;

        // Poster frame — resolve rId
        let posterFramePath: string | undefined;
        const posterRId = cMediaNode["@_posterFrame"];
        if (posterRId) {
          posterFramePath = this.resolveRelationshipTarget(
            slidePath,
            String(posterRId),
          );
        }

        // Extension list — fade, bookmarks, speed, trim overrides
        const extData = parseMediaExtensionData(
          mediaNode,
          cMediaNode,
          shapeId,
          (v: unknown) => this.ensureArray(v),
        );

        // Merge trim values: cTn values take priority, ext overrides fill gaps
        const trimStartMs = timing.trimStartMs ?? extData.trimStartMs;
        const trimEndMs = timing.trimEndMs ?? extData.trimEndMs;

        result.set(shapeId, {
          trimStartMs:
            trimStartMs !== undefined && !isNaN(trimStartMs)
              ? trimStartMs
              : undefined,
          trimEndMs:
            trimEndMs !== undefined && !isNaN(trimEndMs)
              ? trimEndMs
              : undefined,
          fullScreen: fullScreen || undefined,
          loop: timing.loop || undefined,
          posterFramePath,
          volume,
          fadeInDuration: extData.fadeInDuration,
          fadeOutDuration: extData.fadeOutDuration,
          autoPlay: timing.autoPlay || undefined,
          playAcrossSlides: timing.playAcrossSlides || undefined,
          hideWhenNotPlaying: hideWhenNotPlaying || undefined,
          bookmarks:
            extData.bookmarks.length > 0 ? extData.bookmarks : undefined,
          playbackSpeed: extData.playbackSpeed,
        });
      }
    }

    // Recurse into timing containers
    const cTn = node["p:cTn"] as XmlObject | undefined;
    if (cTn) {
      const childTnLst = cTn["p:childTnLst"] as XmlObject | undefined;
      if (childTnLst) {
        for (const container of ["p:par", "p:seq", "p:excl"]) {
          const children = this.ensureArray(childTnLst[container]);
          for (const child of children) {
            this.walkMediaTimingTree(child, result, slidePath);
          }
        }
        // Also check for p:video / p:audio directly inside childTnLst
        this.walkMediaTimingTree(childTnLst, result, slidePath);
      }
    }

    // Direct container children
    for (const container of ["p:par", "p:seq", "p:excl", "p:tnLst"]) {
      const children = this.ensureArray(node[container]);
      for (const child of children) {
        this.walkMediaTimingTree(child, result, slidePath);
      }
    }
  }

  /**
   * Walk the slide's `p:timing` tree and collect media-specific timing data
   * (`p:video` / `p:audio` → `p:cMediaNode`) keyed by target shape ID.
   *
   * Returns a map of shapeId → { trimStartMs, trimEndMs, fullScreen, loop, posterFramePath }.
   */
  protected extractMediaTimingMap(
    slideXml: XmlObject,
    slidePath: string,
  ): Map<string, MediaTimingData> {
    const result = new Map<string, MediaTimingData>();

    try {
      const timing = slideXml?.["p:sld"]?.["p:timing"];
      if (!timing) return result;

      this.walkMediaTimingTree(timing, result, slidePath);
    } catch (e) {
      console.warn("Failed to parse media timing data:", e);
    }

    return result;
  }

  /**
   * Extract the XML shape ID (`p:cNvPr/@_id`) from a parsed element's raw XML.
   * Delegates to standalone utility function.
   */
  protected getXmlShapeId(rawXml: XmlObject | undefined): string | undefined {
    return getXmlShapeIdFromXml(rawXml);
  }

  protected getPathExtension(pathValue: string): string | undefined {
    return getPathExtensionFromPath(pathValue);
  }

  protected getImageMimeType(imagePath: string): string {
    return getImageMimeTypeFromPath(imagePath);
  }

  /**
   * Extract a media file from the PPTX archive as an ArrayBuffer.
   * This avoids the base64 encoding overhead of getImageData, saving ~33%
   * memory for large audio/video files.
   */
  async getMediaArrayBuffer(
    mediaPath: string,
  ): Promise<ArrayBuffer | undefined> {
    if (!mediaPath) return undefined;
    const file = this.zip.file(mediaPath);
    if (!file) return undefined;
    try {
      return await file.async("arraybuffer");
    } catch {
      return undefined;
    }
  }
}
