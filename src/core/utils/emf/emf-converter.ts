/**
 * Public API — the two entry points consumed by the rest of the application.
 *
 * convertEmfToDataUrl  — renders an EMF buffer to a PNG data URL
 * convertWmfToDataUrl  — renders a WMF buffer to a PNG data URL
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
      // Copy to a plain ArrayBuffer — SharedArrayBuffer is not a valid BlobPart in TS 5.x
      const plainBuffer = new ArrayBuffer(img.imageData.byteLength);
      const srcView = new DataView(img.imageData);
      const dstBytes = new Uint8Array(plainBuffer);
      for (let i = 0; i < plainBuffer.byteLength; i++) {
        dstBytes[i] = srcView.getUint8(i);
      }

      ctx.setTransform(
        img.transform[0],
        img.transform[1],
        img.transform[2],
        img.transform[3],
        img.transform[4],
        img.transform[5],
      );

      if (img.isMetafile) {
        emfLog(
          `  Deferred image [${idx}]: recursively converting embedded metafile...`,
        );
        const metafileDataUrl =
          (await convertEmfToDataUrl(plainBuffer)) ??
          (await convertWmfToDataUrl(plainBuffer));
        if (metafileDataUrl) {
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------------------------------------------------------------------
// convertEmfToDataUrl
// ---------------------------------------------------------------------------

/**
 * Converts an EMF binary buffer to a PNG data URL by parsing EMF records
 * and replaying them onto a canvas.
 *
 * Returns `null` if the buffer is not a valid EMF or if no canvas API
 * is available (e.g. in a test environment without DOM/canvas support).
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

    // Restore to clear any clipping regions set during GDI replay
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
 * Converts a WMF binary buffer to a PNG data URL by parsing WMF records
 * and replaying them onto a canvas.
 *
 * Returns `null` if the buffer is not a valid WMF or if no canvas API is
 * available.
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
