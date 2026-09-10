/**
 * `MediaPptxElement` -> `WAnyShape` conversion, split out of
 * `element-to-write-model.ts` to stay under this repo's 300-LOC file budget
 * (mirrors `ole-element-convert.ts`'s split).
 *
 * @module ppt/writer/media-element-convert
 */

import type { PptxElement } from '../../types';
import { elementRectEmu } from './element-rect';
import type { ConvertContext } from './element-to-write-model';
import { degradeElement } from './element-to-write-model';
import { resolveHyperlink } from './hyperlink-model';
import { dataUrlToWav } from './raster-utils';
import type { WAnyShape } from './write-model';

/**
 * Convert an audio media element with WAV data into a `WMedia` shape (see
 * `media-writer.ts` for why this embeds real playable bytes even though
 * PowerPoint's own 97-2003 exporter does not); anything else with no binary
 * `.ppt` equivalent (video, or audio in a non-WAV container) degrades to its
 * preview picture or a placeholder, same as every other unsupported element.
 */
export function convertMedia(element: PptxElement, ctx: ConvertContext): WAnyShape {
	const el = element as PptxElement & {
		mediaType?: string;
		mediaData?: string;
		mediaPath?: string;
	};
	if (el.mediaType === 'audio') {
		const wavBytes =
			dataUrlToWav(el.mediaData) ??
			(el.mediaPath ? ctx.resolvedMedia?.get(el.mediaPath) : undefined);
		if (wavBytes) {
			return {
				kind: 'media',
				wavBytes,
				soundName: element.name ?? 'Sound',
				name: element.name,
				anchor: elementRectEmu(element),
				rotationDeg: element.rotation,
				flipH: element.flipHorizontal,
				flipV: element.flipVertical,
				hyperlink: resolveHyperlink(element.actionClick, ctx.hyperlinkCtx),
			};
		}
	}
	return degradeElement(element, ctx, `[${el.mediaType === 'audio' ? 'Audio' : 'Video'}]`);
}
