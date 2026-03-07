import { XmlObject, PptxElement, type PptxNativeAnimation } from "../../types";
import {
  convertEmfToDataUrl,
  convertWmfToDataUrl,
} from "emf-converter";
import { type MediaTimingData } from "./PptxHandlerRuntimeImageEffects";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeMediaTimingParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  async getImageData(imagePath: string): Promise<string | undefined> {
    if (!imagePath) return undefined;
    const ext = this.getPathExtension(imagePath);

    console.log(
      `[pptx-debug] getImageData called: path="${imagePath}", ext="${ext}"`,
    );

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://") ||
      imagePath.startsWith("data:")
    ) {
      console.log(`[pptx-debug] getImageData: returning URL/data URI directly`);
      return imagePath;
    }

    if (this.imageDataCache.has(imagePath)) {
      const cached = this.imageDataCache.get(imagePath);
      console.log(
        `[pptx-debug] getImageData: cache hit, length=${cached?.length ?? 0}`,
      );
      return cached;
    }

    const imageFile = this.zip.file(imagePath);
    if (!imageFile) {
      console.warn(`[pptx] Image file not found in archive: ${imagePath}`);
      // List available files in ppt/media/ for diagnosis
      const mediaFiles = Object.keys(this.zip.files).filter((f) =>
        f.includes("media/"),
      );
      console.log(
        `[pptx-debug] Available media files in zip: [${mediaFiles.join(", ")}]`,
      );
      return undefined;
    }

    console.log(
      `[pptx-debug] getImageData: found file in zip, name="${imageFile.name}"`,
    );

    try {
      if (ext === "emf" || ext === "wmf") {
        console.log(
          `[pptx-debug] getImageData: extracting ${ext.toUpperCase()} as arraybuffer...`,
        );
        const binaryBuffer = await imageFile.async("arraybuffer");
        console.log(
          `[pptx-debug] getImageData: extracted ${binaryBuffer.byteLength} bytes from JSZip`,
        );

        // Log first 16 bytes
        if (binaryBuffer.byteLength >= 16) {
          const hdrBytes = new Uint8Array(binaryBuffer, 0, 16);
          console.log(
            `[pptx-debug] getImageData: first 16 bytes: [${Array.from(hdrBytes)
              .map((b: number) => b.toString(16).padStart(2, "0"))
              .join(" ")}]`,
          );
        }

        console.log(
          `[pptx-debug] getImageData: calling convert${ext === "emf" ? "Emf" : "Wmf"}ToDataUrl...`,
        );
        const converted =
          ext === "emf"
            ? await convertEmfToDataUrl(binaryBuffer)
            : await convertWmfToDataUrl(binaryBuffer);
        if (converted) {
          console.log(
            `[pptx-debug] getImageData: conversion SUCCESS, dataUrl length=${converted.length}, starts with: ${converted.substring(0, 60)}...`,
          );
          this.imageDataCache.set(imagePath, converted);
          return converted;
        }
        console.warn(
          `[pptx] ${ext.toUpperCase()} conversion returned null for ${imagePath} (${binaryBuffer.byteLength} bytes)`,
        );

        // Fallback: try to find a PNG preview with the same base name
        // PowerPoint often embeds image1.emf alongside image1.png
        const basePath = imagePath.replace(/\.[^.]+$/, "");
        console.log(
          `[pptx-debug] getImageData: trying fallback images for basePath="${basePath}"`,
        );
        for (const fallbackExt of ["png", "jpg", "jpeg", "gif"]) {
          const fallbackPath = `${basePath}.${fallbackExt}`;
          const fallbackFile = this.zip.file(fallbackPath);
          if (fallbackFile) {
            console.log(
              `[pptx-debug] getImageData: found fallback: ${fallbackPath}`,
            );
            try {
              const fallbackBuffer = await fallbackFile.async("base64");
              const fallbackData = `data:image/${fallbackExt === "jpg" ? "jpeg" : fallbackExt};base64,${fallbackBuffer}`;
              this.imageDataCache.set(imagePath, fallbackData);
              return fallbackData;
            } catch {
              // Continue to next fallback
            }
          }
        }
        console.warn(
          `[pptx-debug] getImageData: no fallback image found, returning undefined`,
        );

        return undefined;
      }

      const imageBuffer = await imageFile.async("base64");
      const imageData = `data:${this.getImageMimeType(imagePath)};base64,${imageBuffer}`;
      console.log(
        `[pptx-debug] getImageData: loaded ${ext} image, base64 length=${imageBuffer.length}, dataUrl length=${imageData.length}`,
      );
      this.imageDataCache.set(imagePath, imageData);
      return imageData;
    } catch (err) {
      console.warn(`[pptx] Failed to load image: ${imagePath}`, err);
      return undefined;
    }
  }

  /**
   * Enrich parsed media elements with timing data from the slide's
   * `p:timing` tree (trim, loop, poster frame, fullScreen).
   */
  protected async enrichMediaElementsWithTiming(
    elements: PptxElement[],
    timingMap: Map<string, MediaTimingData>,
  ): Promise<void> {
    for (const el of elements) {
      if (el.type !== "media") continue;
      const spid = this.getXmlShapeId(el.rawXml as XmlObject | undefined);
      if (!spid) continue;

      const timing = timingMap.get(spid);
      if (!timing) continue;

      // Apply trim, loop, and fullScreen data
      if (timing.trimStartMs !== undefined) el.trimStartMs = timing.trimStartMs;
      if (timing.trimEndMs !== undefined) el.trimEndMs = timing.trimEndMs;
      if (timing.fullScreen !== undefined) el.fullScreen = timing.fullScreen;
      if (timing.loop !== undefined) el.loop = timing.loop;

      // New media properties
      if (timing.volume !== undefined) el.volume = timing.volume;
      if (timing.fadeInDuration !== undefined)
        el.fadeInDuration = timing.fadeInDuration;
      if (timing.fadeOutDuration !== undefined)
        el.fadeOutDuration = timing.fadeOutDuration;
      if (timing.autoPlay !== undefined) el.autoPlay = timing.autoPlay;
      if (timing.playAcrossSlides !== undefined)
        el.playAcrossSlides = timing.playAcrossSlides;
      if (timing.hideWhenNotPlaying !== undefined)
        el.hideWhenNotPlaying = timing.hideWhenNotPlaying;
      if (timing.bookmarks !== undefined && timing.bookmarks.length > 0) {
        el.bookmarks = timing.bookmarks;
      }
      if (timing.playbackSpeed !== undefined)
        el.playbackSpeed = timing.playbackSpeed;

      // Load poster frame image data if available
      if (timing.posterFramePath) {
        el.posterFramePath = timing.posterFramePath;
        try {
          const posterData = await this.getImageData(timing.posterFramePath);
          if (posterData) {
            el.posterFrameData = posterData;
          }
        } catch {
          // Non-critical: poster frame is optional
        }
      }
    }

    // Also check inside groups (one level deep)
    for (const el of elements) {
      if (el.type === "group" && el.children) {
        await this.enrichMediaElementsWithTiming(el.children, timingMap);
      }
    }
  }

  /**
   * Parse native OOXML animations from `p:sld/p:timing`.
   * Extracts trigger types, preset classes, durations, and target IDs.
   */
  protected parseNativeAnimations(
    slideXml: XmlObject,
  ): PptxNativeAnimation[] | undefined {
    return this.nativeAnimationService.parseNativeAnimations(slideXml);
  }
}
