import type { PptxElement } from 'pptx-viewer-core';
import { classifyMediaType } from 'pptx-viewer-shared';
import type { CanvasSize } from 'pptx-viewer-shared';

import { centerOnCanvas } from './editor-insert';

/**
 * Insert-media factory for the Svelte editor: given an already-chosen
 * audio/video `File`, reads it as a data URL, probes video dimensions (audio
 * gets a fixed player-strip size), and returns a centred `media` element.
 * The `<input type="file">` + change-handler wiring stays in `InsertTab.svelte`
 * (matching the existing image insert), so this module owns only the pure
 * file-to-element conversion and stays independently testable.
 */

/** Fixed size (px) for an inserted audio player strip. */
const AUDIO_SIZE = { width: 420, height: 64 };
/** Default/capped size (px) for an inserted video (aspect kept when probeable). */
const VIDEO_MAX_SIZE = { width: 640, height: 360 };

/** The media kind a chosen file maps to, or `null` for an unsupported type. */
export const mediaTypeOfFile = classifyMediaType;

/** Probe a video data URL's natural dimensions, capped to `VIDEO_MAX_SIZE`. */
function probeVideoSize(dataUrl: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const probe = document.createElement('video');
		probe.preload = 'metadata';
		probe.onloadedmetadata = () => {
			const w = probe.videoWidth || VIDEO_MAX_SIZE.width;
			const h = probe.videoHeight || VIDEO_MAX_SIZE.height;
			if (w > VIDEO_MAX_SIZE.width || h > VIDEO_MAX_SIZE.height) {
				const scale = Math.min(VIDEO_MAX_SIZE.width / w, VIDEO_MAX_SIZE.height / h);
				resolve({ width: Math.round(w * scale), height: Math.round(h * scale) });
				return;
			}
			resolve({ width: w, height: h });
		};
		probe.onerror = () => resolve(VIDEO_MAX_SIZE);
		probe.src = dataUrl;
	});
}

/** Read `file` as a `data:` URL. Resolves `null` if the file cannot be read. */
function readAsDataUrl(file: File): Promise<string | null> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
		reader.onerror = () => resolve(null);
		reader.readAsDataURL(file);
	});
}

/**
 * Build a centred `media` element from a chosen audio/video `File`. Resolves
 * `null` when the file isn't audio/video or can't be read.
 */
export async function buildMediaInsertElement(
	file: File,
	canvasSize: CanvasSize,
): Promise<PptxElement | null> {
	const mediaType = mediaTypeOfFile(file.type);
	if (!mediaType) {
		return null;
	}
	const dataUrl = await readAsDataUrl(file);
	if (!dataUrl) {
		return null;
	}
	const size = mediaType === 'audio' ? AUDIO_SIZE : await probeVideoSize(dataUrl);
	const el = {
		id: '',
		type: 'media',
		name: mediaType === 'audio' ? 'Audio' : 'Video',
		mediaType,
		mediaMimeType: file.type || undefined,
		mediaData: dataUrl,
		x: 0,
		y: 0,
		width: size.width,
		height: size.height,
	} as unknown as PptxElement;
	centerOnCanvas(el, canvasSize);
	return el;
}
