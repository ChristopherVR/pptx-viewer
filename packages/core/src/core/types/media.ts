/**
 * Media types: audio/video discriminator, bookmarks, runtime metadata,
 * and caption/subtitle tracks.
 *
 * @module pptx-types/media
 */

// ==========================================================================
// Media types (audio/video)
// ==========================================================================

/**
 * Discriminator for embedded media element types.
 *
 * @example
 * ```ts
 * const kind: PptxMediaType = "video";
 * // => "video" — one of: "video" | "audio" | "unknown"
 * ```
 */
export type PptxMediaType = "video" | "audio" | "unknown";

/**
 * A named bookmark within a media clip timeline.
 *
 * @example
 * ```ts
 * const bm: MediaBookmark = {
 *   id: "bm1",
 *   time: 12.5,
 *   label: "Intro ends",
 * };
 * // => satisfies MediaBookmark
 * ```
 */
export interface MediaBookmark {
  id: string;
  /** Position in seconds from the start of the clip. */
  time: number;
  /** User-visible label for this bookmark. */
  label: string;
}

/**
 * Runtime-extracted metadata about a media clip (populated from HTMLMediaElement).
 *
 * @example
 * ```ts
 * const meta: MediaMetadata = {
 *   duration: 120.5,
 *   videoWidth: 1920,
 *   videoHeight: 1080,
 *   codecInfo: "video/mp4; codecs=\"avc1.640028\"",
 * };
 * // => satisfies MediaMetadata
 * ```
 */
export interface MediaMetadata {
  /** Duration in seconds. */
  duration?: number;
  /** Video width in pixels (video only). */
  videoWidth?: number;
  /** Video height in pixels (video only). */
  videoHeight?: number;
  /** MIME type / codec string reported by the browser. */
  codecInfo?: string;
}

/**
 * A closed-caption / subtitle track associated with a media element.
 *
 * @example
 * ```ts
 * const track: MediaCaptionTrack = {
 *   id: "t1",
 *   label: "English",
 *   language: "en",
 *   kind: "subtitles",
 *   isDefault: true,
 * };
 * // => satisfies MediaCaptionTrack
 * ```
 */
export interface MediaCaptionTrack {
  /** Unique ID for this track. */
  id: string;
  /** Human-readable label (e.g. "English", "Spanish"). */
  label: string;
  /** BCP-47 language code (e.g. "en", "es"). */
  language: string;
  /** Track kind: subtitles, captions, or descriptions. */
  kind: "subtitles" | "captions" | "descriptions";
  /** Data URL or path to the VTT/SRT content within the PPTX archive. */
  src?: string;
  /** Inline VTT content (for embedded captions). */
  content?: string;
  /** Whether this track is the default/active one. */
  isDefault?: boolean;
}
