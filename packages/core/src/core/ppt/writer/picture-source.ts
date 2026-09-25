/**
 * Where a picture-bearing element keeps its picture, for the `.ppt`
 * writer's picture pre-pass (`picture-resolve.ts`) and its synchronous
 * converters (`element-to-write-model.ts`, `degrade-element.ts`,
 * `ole-element-convert.ts`), so both read the same fields.
 *
 * @module ppt/writer/picture-source
 */

import type { PptxElement } from '../../types';

/** A picture's inline URL (data: or blob:) and/or its package part path. */
export interface PictureSource {
	/** Inline `data:`/`blob:` URL, when the element carries one. */
	inline?: string;
	/** Package part path of the picture itself. */
	partPath?: string;
	/** An SVG picture's `asvg:svgBlip` part, used when there is no raster at all. */
	svgPath?: string;
}

function isInlineUrl(value: string | undefined): value is string {
	return Boolean(value && (value.startsWith('data:') || value.startsWith('blob:')));
}

/**
 * The picture source of an image/picture, a media element's poster frame,
 * an OLE object's preview, or a 3D model's poster; `undefined` for every
 * other element type.
 */
export function pictureSourceOf(el: PptxElement): PictureSource | undefined {
	switch (el.type) {
		case 'image':
		case 'picture':
			return { inline: el.imageData, partPath: el.imagePath, svgPath: el.svgPath };
		case 'media':
			return { inline: el.posterFrameData, partPath: el.posterFramePath };
		case 'ole': {
			const preview = el.previewImage;
			return {
				inline: el.previewImageData ?? (isInlineUrl(preview) ? preview : undefined),
				partPath: preview && !isInlineUrl(preview) ? preview : undefined,
			};
		}
		case 'model3d':
			return { inline: el.posterImage };
		default:
			return undefined;
	}
}
