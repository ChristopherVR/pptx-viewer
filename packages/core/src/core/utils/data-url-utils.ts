export function parseDataUrlToBytes(
  dataUrl: string,
): { bytes: Uint8Array; extension: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const base64Payload = match[2];

  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/tif": "tiff",
    "image/avif": "avif",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/x-ms-wmv": "wmv",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
  };
  const extension = extensionByMime[mime] || "bin";

  try {
    const bufferCtor = (
      globalThis as unknown as {
        Buffer?: { from: (value: string, encoding: string) => Uint8Array };
      }
    ).Buffer;
    const bytes = bufferCtor
      ? new Uint8Array(bufferCtor.from(base64Payload, "base64"))
      : Uint8Array.from(atob(base64Payload), (char) => char.charCodeAt(0));

    return {
      bytes,
      extension,
    };
  } catch {
    return null;
  }
}

/** Extension lookup for MIME types from URL responses. */
const extensionByResponseMime: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/x-ms-wmv": "wmv",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/octet-stream": "bin",
};

/**
 * Resolve a media source URL (pptx-resource://, blob:, http(s)://) to raw
 * bytes by fetching it. Returns null on failure.
 *
 * This is used during PPTX save to embed media that was streamed from disk
 * (via pptx-resource:// URLs) rather than stored as base64 data URLs.
 */
export async function fetchUrlToBytes(
  url: string,
): Promise<{ bytes: Uint8Array; extension: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const contentType = (
      response.headers.get("Content-Type") ?? "application/octet-stream"
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    // Try to infer extension from Content-Type header
    let extension = extensionByResponseMime[contentType];

    // Fall back to URL path extension
    if (!extension) {
      try {
        const urlPath = new URL(url).pathname;
        const dotIdx = urlPath.lastIndexOf(".");
        if (dotIdx !== -1) {
          extension = urlPath.substring(dotIdx + 1).toLowerCase();
        }
      } catch {
        // URL parsing failed — use default
      }
    }

    return {
      bytes: new Uint8Array(arrayBuffer),
      extension: extension || "bin",
    };
  } catch {
    return null;
  }
}
