/**
 * Synchronous, pure "read the real duration from media bytes" dispatcher.
 *
 * Exists so a slide's `onStopAudio` timing fallback (used whenever no real
 * `<audio>`/`<video>` element is mounted to fire a genuine `ended` event:
 * headless export, SSR, or an unmounted slide) can use the ACTUAL clip
 * duration instead of PowerPoint's own authored estimate
 * (`p:cond/@delay`), which desyncs from playback for a trimmed or
 * since-swapped media file (see `docs/guide/limitations.md`,
 * "`onStopAudio` in headless export").
 *
 * Format sniffing is by magic bytes, not a caller-supplied MIME type, for the
 * same reason {@link module:image-first-pixel} does: a mislabelled embedded
 * media part is not rare. WebM/MKV and MP4/MOV/M4A share no useful common
 * detection order with the others, so each format's sniff is independent and
 * cheap (checked in isolation, not as a fallback chain that could misfire).
 *
 * @module media-duration
 */
import { estimateAdtsDurationMs } from './media-duration-adts';
import { estimateEbmlDurationMs } from './media-duration-ebml';
import { estimateIsoBmffDurationMs, looksLikeIsoBmff } from './media-duration-isobmff';
import { estimateMp3DurationMs } from './media-duration-mp3';
import { estimateOggDurationMs } from './media-duration-ogg';
import { estimateWavDurationMs } from './media-duration-wav';

/**
 * Estimate a media file's duration in milliseconds, purely from its bytes.
 * Returns `undefined` when the format is unrecognised or the relevant
 * duration/rate fields could not be read - callers should fall back to
 * whatever estimate they already had (the OOXML-authored delay, or a
 * runtime-measured `HTMLMediaElement.duration` once one exists).
 */
export function estimateMediaDurationMs(bytes: Uint8Array): number | undefined {
	if (bytes.length < 4) {
		return undefined;
	}
	try {
		if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
			return estimateWavDurationMs(bytes);
		}
		if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
			return estimateOggDurationMs(bytes);
		}
		if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
			return estimateEbmlDurationMs(bytes);
		}
		if (looksLikeIsoBmff(bytes)) {
			return estimateIsoBmffDurationMs(bytes);
		}
		if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
			return estimateMp3DurationMs(bytes); // ID3v2-tagged MP3
		}
		if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) {
			// Frame-sync 0xFFEx: either an MP3 frame (MPEG Audio Layer III,
			// layerId===1) or an ADTS AAC frame (layerId bits differ). Try MP3
			// first since it validates layer/version more strictly.
			const mp3 = estimateMp3DurationMs(bytes);
			if (mp3 !== undefined) {
				return mp3;
			}
			return estimateAdtsDurationMs(bytes);
		}
		return undefined;
	} catch {
		return undefined;
	}
}
