import { XmlObject, type MediaBookmark } from "../../types";

/** Callback type matching `PptxHandlerRuntime.ensureArray`. */
export type EnsureArrayFn = (value: unknown) => XmlObject[];

/** Data extracted from p:cTn timing node. */
export interface CtnTimingData {
  trimStartMs: number | undefined;
  trimEndMs: number | undefined;
  loop: boolean;
  autoPlay: boolean;
  playAcrossSlides: boolean;
}

/** Data extracted from the extension list of a media node. */
export interface MediaExtensionData {
  trimStartMs: number | undefined;
  trimEndMs: number | undefined;
  fadeInDuration: number | undefined;
  fadeOutDuration: number | undefined;
  playbackSpeed: number | undefined;
  bookmarks: MediaBookmark[];
}

/**
 * Extract the XML shape ID (`p:cNvPr/@_id`) from a parsed element's raw XML.
 * Tries all known non-visual property wrappers (sp, pic, graphicFrame, cxnSp).
 */
export function getXmlShapeIdFromXml(
  rawXml: XmlObject | undefined,
): string | undefined {
  if (!rawXml) return undefined;
  const nvPaths = [
    ["p:nvGraphicFramePr", "p:cNvPr"],
    ["p:nvPicPr", "p:cNvPr"],
    ["p:nvSpPr", "p:cNvPr"],
    ["p:nvCxnSpPr", "p:cNvPr"],
  ] as const;
  for (const [nvProp, cNvPr] of nvPaths) {
    const id = (rawXml[nvProp] as XmlObject | undefined)?.[cNvPr as string]?.[
      "@_id"
    ];
    if (id !== undefined) return String(id);
  }
  return undefined;
}

/** Extract the file extension from a path string, stripping hash/query fragments. */
export function getPathExtensionFromPath(
  pathValue: string,
): string | undefined {
  const normalizedPath = String(pathValue || "").trim();
  if (!normalizedPath) return undefined;
  const withoutHash = normalizedPath.split("#")[0] || normalizedPath;
  const withoutQuery = withoutHash.split("?")[0] || withoutHash;
  const extension = withoutQuery.split(".").pop()?.toLowerCase();
  return extension && extension.length > 0 ? extension : undefined;
}

/** Map a file path to its MIME type based on the file extension. */
export function getImageMimeTypeFromPath(imagePath: string): string {
  const ext = getPathExtensionFromPath(imagePath);
  if (ext === "png") return "image/png";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "emf") return "image/x-emf";
  if (ext === "wmf") return "image/x-wmf";
  if (ext === "bmp") return "image/bmp";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  if (ext === "heic") return "image/heic";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  if (ext === "ogv") return "video/ogg";
  if (ext === "avi") return "video/x-msvideo";
  if (ext === "wmv") return "video/x-ms-wmv";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "wav") return "audio/wav";
  if (ext === "oga" || ext === "ogg") return "audio/ogg";
  if (ext === "flac") return "audio/flac";
  return "image/jpeg";
}

/**
 * Parse timing flags from a `p:cTn` node within a `p:cMediaNode`.
 */
export function parseCtnMediaTiming(
  cTn: XmlObject | undefined,
  mediaTag: string,
): CtnTimingData {
  let trimStartMs: number | undefined;
  let trimEndMs: number | undefined;
  let loop = false;
  let autoPlay = false;
  let playAcrossSlides = false;

  if (cTn) {
    if (cTn["@_st"] !== undefined) {
      trimStartMs = parseInt(String(cTn["@_st"]));
    }
    if (cTn["@_end"] !== undefined) {
      trimEndMs = parseInt(String(cTn["@_end"]));
    }
    const repeatCount = cTn["@_repeatCount"];
    if (repeatCount !== undefined && String(repeatCount) === "indefinite") {
      loop = true;
    }
    // Auto-play: nodeType=1 means "with previous" (auto), 2 = "after previous"
    const nodeType = cTn["@_nodeType"];
    if (
      nodeType === "1" ||
      nodeType === "2" ||
      nodeType === 1 ||
      nodeType === 2
    ) {
      autoPlay = true;
    }
    // Play across slides: dur="indefinite" on the cTn means the media
    // timeline is not bound to the current slide's lifetime.
    const dur = cTn["@_dur"];
    if (String(dur) === "indefinite" && mediaTag === "p:audio") {
      playAcrossSlides = true;
    }
  }

  return { trimStartMs, trimEndMs, loop, autoPlay, playAcrossSlides };
}

/**
 * Parse extension list data for a media node, extracting fade durations,
 * playback speed, trim overrides, and bookmarks.
 */
export function parseMediaExtensionData(
  mediaNode: XmlObject,
  cMediaNode: XmlObject,
  shapeId: string,
  ensureArray: EnsureArrayFn,
): MediaExtensionData {
  let fadeInDuration: number | undefined;
  let fadeOutDuration: number | undefined;
  let playbackSpeed: number | undefined;
  let trimStartMs: number | undefined;
  let trimEndMs: number | undefined;
  const bookmarks: MediaBookmark[] = [];

  const extLst = (mediaNode["p:extLst"] ?? cMediaNode["p:extLst"]) as
    | XmlObject
    | undefined;
  if (extLst) {
    const exts = ensureArray(extLst["p:ext"]);
    for (const ext of exts) {
      // p14:media — contains fade info and trim in some formats
      const p14Media = ext["p14:media"] as XmlObject | undefined;
      if (p14Media) {
        const p14Trim = p14Media["p14:trim"] as XmlObject | undefined;
        if (p14Trim) {
          // st and end are in microseconds (divide by 1000 for ms)
          const st = p14Trim["@_st"];
          if (st !== undefined && trimStartMs === undefined) {
            const val = parseInt(String(st));
            if (Number.isFinite(val)) trimStartMs = val / 1000;
          }
          const end = p14Trim["@_end"];
          if (end !== undefined && trimEndMs === undefined) {
            const val = parseInt(String(end));
            if (Number.isFinite(val)) trimEndMs = val / 1000;
          }
        }
        const p14Fade = p14Media["p14:fade"] as XmlObject | undefined;
        if (p14Fade) {
          // in/out durations in milliseconds
          const fadeInRaw = p14Fade["@_in"];
          if (fadeInRaw !== undefined) {
            const val = parseInt(String(fadeInRaw));
            if (Number.isFinite(val)) fadeInDuration = val / 1000;
          }
          const fadeOutRaw = p14Fade["@_out"];
          if (fadeOutRaw !== undefined) {
            const val = parseInt(String(fadeOutRaw));
            if (Number.isFinite(val)) fadeOutDuration = val / 1000;
          }
        }
        // Playback speed: @spd is percentage * 1000 (e.g. 100000 = 1x, 200000 = 2x)
        const spdRaw = p14Media["@_spd"];
        if (spdRaw !== undefined) {
          const spdVal = parseInt(String(spdRaw));
          if (Number.isFinite(spdVal) && spdVal > 0) {
            playbackSpeed = spdVal / 100000;
          }
        }
      }

      // p14:bmkLst — bookmarks
      const bmkLst = ext["p14:bmkLst"] as XmlObject | undefined;
      if (bmkLst) {
        const bmks = ensureArray(bmkLst["p14:bmk"]);
        for (const bmk of bmks) {
          const bmkName = bmk["@_name"];
          const bmkTime = bmk["@_time"];
          if (bmkName !== undefined && bmkTime !== undefined) {
            const timeVal = parseInt(String(bmkTime));
            if (Number.isFinite(timeVal)) {
              bookmarks.push({
                id: `bmk-${shapeId}-${timeVal}`,
                time: timeVal / 1000, // ms to seconds
                label: String(bmkName),
              });
            }
          }
        }
      }
    }
  }

  return {
    trimStartMs,
    trimEndMs,
    fadeInDuration,
    fadeOutDuration,
    playbackSpeed,
    bookmarks,
  };
}
