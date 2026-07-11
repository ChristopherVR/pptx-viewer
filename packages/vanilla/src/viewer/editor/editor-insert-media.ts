import type { PptxElement } from 'pptx-viewer-core';
import { createEditorId } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';

import { centerOnCanvas } from './editor-insert';

/**
 * Insert-media factory for the vanilla editor: opens a native audio/video file
 * picker, reads the chosen file as a data URL, probes video dimensions (audio
 * gets a fixed player-strip size), and returns a centred `media` element.
 * Mirrors `pickImageElement`'s async DOM-side-effect shape in `editor-insert.ts`.
 */

/** Fixed size (px) for an inserted audio player strip. */
const AUDIO_SIZE = { width: 420, height: 64 };
/** Default/capped size (px) for an inserted video (aspect kept when probeable). */
const VIDEO_MAX_SIZE = { width: 640, height: 360 };

/** Probe a video data URL's natural dimensions, capped to `VIDEO_MAX_SIZE`. */
function probeVideoSize(
	doc: Document,
	dataUrl: string,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const probe = doc.createElement('video');
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

/**
 * Open a native audio/video file picker, read the chosen file as a data URL,
 * size it (video: probed + capped, audio: a fixed player strip), and return a
 * centred media element. Resolves `null` when the user cancels, picks an
 * unsupported file type, or the file cannot be read.
 */
export function pickMediaElement(
	doc: Document,
	canvasSize: CanvasSize,
): Promise<PptxElement | null> {
	return new Promise((resolve) => {
		const input = doc.createElement('input');
		input.type = 'file';
		input.accept = 'video/*,audio/*';
		input.style.display = 'none';
		doc.body.appendChild(input);
		const cleanup = (): void => input.remove();
		input.addEventListener('cancel', () => {
			cleanup();
			resolve(null);
		});
		input.addEventListener('change', () => {
			const file = input.files?.[0];
			cleanup();
			if (!file) {
				resolve(null);
				return;
			}
			const mediaType = file.type.startsWith('audio/')
				? 'audio'
				: file.type.startsWith('video/')
					? 'video'
					: null;
			if (!mediaType) {
				resolve(null);
				return;
			}
			const reader = new FileReader();
			reader.onload = async () => {
				const dataUrl = typeof reader.result === 'string' ? reader.result : '';
				if (!dataUrl) {
					resolve(null);
					return;
				}
				const size = mediaType === 'audio' ? AUDIO_SIZE : await probeVideoSize(doc, dataUrl);
				const el = {
					id: createEditorId('media'),
					type: 'media',
					mediaType,
					mediaMimeType: file.type || undefined,
					mediaData: dataUrl,
					x: 0,
					y: 0,
					width: size.width,
					height: size.height,
				} as unknown as PptxElement;
				centerOnCanvas(el, canvasSize);
				resolve(el);
			};
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(file);
		});
		input.click();
	});
}
