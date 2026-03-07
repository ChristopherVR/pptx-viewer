/**
 * Public API — the two entry points consumed by the rest of the application.
 *
 * The conversion pipeline for both formats follows the same high-level steps:
 * 1. Parse the file header to determine logical bounds and canvas dimensions.
 * 2. Create an in-memory canvas (OffscreenCanvas preferred, HTMLCanvasElement fallback).
 * 3. Replay every metafile record onto the canvas context in order.
 * 4. Resolve "deferred images" — bitmap / embedded-metafile draws that require
 *    async image decoding (via {@link createImageBitmap}).
 * 5. Export the canvas contents as a `data:image/png;base64,…` URL.
 *
 * @module emf-converter
 */

import { emfLog, emfWarn } from "./emf-logging";
import { createCanvas, exportCanvasToPngDataUrl } from "./emf-canvas-helpers";
import {
  parseEmfHeader,
  getRenderableEmfBounds,
  parseWmfHeader,
} from "./emf-header-parser";
import { replayEmfRecords } from "./emf-record-replay";
import { replayWmfRecords } from "./wmf-replay";
import type { DeferredImageDraw } from "./emf-types";

// ---------------------------------------------------------------------------
// Deferred-image post-processing
// ---------------------------------------------------------------------------

/**
 * Processes images whose drawing was deferred during the synchronous record
 * replay pass. Each entry may be a raster image (PNG/BMP bytes) or an
 * embedded metafile that must be recursively converted before it can be drawn.
 *
 * The canvas transform is set per-image so the bitmap lands at the correct
 * position, then reset to identity when all images have been drawn.
 *
 * @param ctx            - The 2D rendering context of the output canvas.
 * @param deferredImages - The list of deferred image-draw descriptors
 *                         accumulated during GDI / EMF+ record replay.
 */
async function processDeferredImages(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  deferredImages: DeferredImageDraw[],
): Promise<void> {
  emfLog(
    `processDeferredImages: processing ${deferredImages.length} deferred images...`,
  );

  for (let idx = 0; idx < deferredImages.length; idx++) {
    const img = deferredImages[idx];
    emfLog(
      `  Deferred image [${idx}]: isMetafile=${img.isMetafile}, dataLen=${img.imageData.byteLength}, ` +
        `dest=(${img.dx.toFixed(1)},${img.dy.toFixed(1)},${img.dw.toFixed(1)},${img.dh.toFixed(1)}), ` +
        `transform=[${img.transform.map((v) => v.toFixed(3)).join(",")}]`,
    );
    try {
      // Copy to a plain ArrayBuffer — SharedArrayBuffer is not accepted
      // as a BlobPart by the Blob constructor in TypeScript 5.x strict mode.
      const plainBuffer = new ArrayBuffer(img.imageData.byteLength);
      const srcView = new DataView(img.imageData);
      const dstBytes = new Uint8Array(plainBuffer);
      for (let i = 0; i < plainBuffer.byteLength; i++) {
        dstBytes[i] = srcView.getUint8(i);
      }

      // Restore the affine transform that was active when the image draw was
      // originally encountered, so the bitmap is placed correctly on canvas.
      ctx.setTransform(
        img.transform[0],
        img.transform[1],
        img.transform[2],
        img.transform[3],
        img.transform[4],
        img.transform[5],
      );

      if (img.isMetafile) {
        // Embedded metafiles must be recursively converted to a raster image
        // before they can be drawn — try EMF first, then fall back to WMF.
        emfLog(
          `  Deferred image [${idx}]: recursively converting embedded metafile...`,
        );
        const metafileDataUrl =
          (await convertEmfToDataUrl(plainBuffer)) ??
          (await convertWmfToDataUrl(plainBuffer));
        if (metafileDataUrl) {
          // Decode the data-URL back to raw bytes so we can build a Blob
          // and hand it to createImageBitmap for drawing.
          emfLog(
            `  Deferred image [${idx}]: metafile converted, dataUrl length=${metafileDataUrl.length}`,
          );
          const byteString = atob(metafileDataUrl.split(",")[1]);
          const mimeMatch = metafileDataUrl.match(/data:([^;]+)/);
          const mime = mimeMatch ? mimeMatch[1] : "image/png";
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const metaBlob = new Blob([ab], { type: mime });
          emfLog(
            `  Deferred image [${idx}]: creating ImageBitmap from ${metaBlob.size} byte blob (${mime})...`,
          );
          const bitmap = await createImageBitmap(metaBlob);
          emfLog(
            `  Deferred image [${idx}]: ImageBitmap created ${bitmap.width}×${bitmap.height}`,
          );
          ctx.drawImage(bitmap, img.dx, img.dy, img.dw, img.dh);
          bitmap.close();
        } else {
          emfWarn(
            `  Deferred image [${idx}]: metafile conversion returned null`,
          );
        }
      } else {
        emfLog(
          `  Deferred image [${idx}]: creating ImageBitmap from ${plainBuffer.byteLength} byte blob...`,
        );
        const blob = new Blob([plainBuffer]);
        const bitmap = await createImageBitmap(blob);
        emfLog(
          `  Deferred image [${idx}]: ImageBitmap created ${bitmap.width}×${bitmap.height}`,
        );
        ctx.drawImage(bitmap, img.dx, img.dy, img.dw, img.dh);
        bitmap.close();
      }
    } catch (imgErr) {
      const errMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
      emfWarn(`  Deferred image [${idx}]: DRAW FAILED: ${errMsg}`);
      console.warn(
        "[emf-converter] Deferred image draw failed:",
        imgErr instanceof Error ? imgErr.message : imgErr,
        `(isMetafile=${img.isMetafile}, dataLen=${img.imageData.byteLength})`,
      );
    }
  }
  // Reset to identity so subsequent callers start with a clean transform.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------------------------------------------------------------------
// convertEmfToDataUrl
// ---------------------------------------------------------------------------

/**
 * Converts an EMF (Enhanced Metafile) binary buffer to a PNG data-URL string
 * by parsing the EMF header, iterating over all EMR records, and replaying
 * them onto an in-memory canvas. Embedded EMF+ (GDI+) records found inside
 * EMR_COMMENT payloads are handled transparently.
 *
 * Returns `null` when:
 * - The buffer does not begin with a valid EMR_HEADER record.
 * - The logical bounds are zero-sized or negative.
 * - No canvas API is available (e.g. headless test environment).
 *
 * @param buffer    - The raw EMF file bytes.
 * @param maxWidth  - Optional cap on the output canvas width (pixels).
 * @param maxHeight - Optional cap on the output canvas height (pixels).
 * @returns A `data:image/png;base64,…` string, or `null` on failure.
 */
export async function convertEmfToDataUrl(
  buffer: ArrayBuffer,
  maxWidth?: number,
  maxHeight?: number,
): Promise<string | null> {
  try {
    emfLog("=== convertEmfToDataUrl START ===");
    emfLog(
      `Input buffer: ${buffer.byteLength} bytes, maxWidth=${maxWidth}, maxHeight=${maxHeight}`,
    );

    if (buffer.byteLength >= 16) {
      const hdrBytes = new Uint8Array(buffer, 0, 16);
      emfLog(
        `First 16 bytes: [${Array.from(hdrBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ")}]`,
      );
    }

    const view = new DataView(buffer);
    const header = parseEmfHeader(view);
    if (!header) {
      emfLog(
        "convertEmfToDataUrl: parseEmfHeader returned null — returning null",
      );
      return null;
    }
    const renderBounds = getRenderableEmfBounds(header);
    if (!renderBounds) {
      emfLog(
        "convertEmfToDataUrl: getRenderableEmfBounds returned null — returning null",
      );
      return null;
    }

    const logicalW = renderBounds.right - renderBounds.left;
    const logicalH = renderBounds.bottom - renderBounds.top;
    emfLog(`convertEmfToDataUrl: logicalSize=${logicalW}×${logicalH}`);

    const setup = createCanvas(logicalW, logicalH, maxWidth, maxHeight);
    if (!setup) {
      emfLog(
        "convertEmfToDataUrl: createCanvas returned null — returning null",
      );
      return null;
    }

    const { canvas, ctx } = setup;
    emfLog(
      `convertEmfToDataUrl: canvas created ${canvas.width}×${canvas.height}`,
    );

    ctx.save();

    emfLog("convertEmfToDataUrl: starting replayEmfRecords...");
    const deferredImages = replayEmfRecords(
      view,
      ctx,
      renderBounds,
      canvas.width,
      canvas.height,
    );
    emfLog(
      `convertEmfToDataUrl: replayEmfRecords returned ${deferredImages.length} deferred images`,
    );

    // Restore the canvas state saved before replay — this clears any
    // clipping regions that GDI record handlers may have installed.
    ctx.restore();

    await processDeferredImages(ctx, deferredImages);

    emfLog("convertEmfToDataUrl: exporting canvas to PNG data URL...");
    const result = await exportCanvasToPngDataUrl(canvas);
    if (result) {
      emfLog(`convertEmfToDataUrl: SUCCESS — data URL length=${result.length}`);
    } else {
      emfWarn("convertEmfToDataUrl: exportCanvasToPngDataUrl returned null");
    }
    emfLog("=== convertEmfToDataUrl END ===");
    return result;
  } catch (err) {
    emfWarn(
      "convertEmfToDataUrl: EXCEPTION:",
      err instanceof Error ? err.message : err,
    );
    console.warn(
      "[pptx-editor] EMF conversion failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// convertWmfToDataUrl
// ---------------------------------------------------------------------------

/**
 * Converts a WMF (Windows Metafile) binary buffer to a PNG data-URL string.
 *
 * WMF is the older 16-bit metafile format with simpler record types than EMF.
 * This function parses the optional Aldus placeable header, the WMF header,
 * and then replays all META_* records onto a canvas.
 *
 * Returns `null` when:
 * - The header cannot be parsed or reports invalid dimensions.
 * - No canvas API is available.
 *
 * @param buffer    - The raw WMF file bytes.
 * @param maxWidth  - Optional cap on the output canvas width (pixels).
 * @param maxHeight - Optional cap on the output canvas height (pixels).
 * @returns A `data:image/png;base64,…` string, or `null` on failure.
 */
export async function convertWmfToDataUrl(
  buffer: ArrayBuffer,
  maxWidth?: number,
  maxHeight?: number,
): Promise<string | null> {
  try {
    emfLog(
      "=== convertWmfToDataUrl START ===",
      `buffer=${buffer.byteLength} bytes`,
    );
    const view = new DataView(buffer);
    const header = parseWmfHeader(view);
    if (!header) {
      emfLog("convertWmfToDataUrl: parseWmfHeader returned null");
      return null;
    }

    const logicalW = header.boundsRight - header.boundsLeft;
    const logicalH = header.boundsBottom - header.boundsTop;
    emfLog(`convertWmfToDataUrl: logicalSize=${logicalW}×${logicalH}`);

    if (logicalW <= 0 || logicalH <= 0) {
      emfLog("convertWmfToDataUrl: invalid dimensions — returning null");
      return null;
    }

    const setup = createCanvas(logicalW, logicalH, maxWidth, maxHeight);
    if (!setup) return null;

    const { canvas, ctx } = setup;

    replayWmfRecords(view, ctx, header, canvas.width, canvas.height);

    const result = await exportCanvasToPngDataUrl(canvas);
    emfLog(
      `convertWmfToDataUrl: result=${result ? `dataUrl len=${result.length}` : "null"}`,
    );
    emfLog("=== convertWmfToDataUrl END ===");
    return result;
  } catch (err) {
    emfWarn(
      "convertWmfToDataUrl: EXCEPTION:",
      err instanceof Error ? err.message : err,
    );
    console.warn(
      "[pptx-editor] WMF conversion failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
