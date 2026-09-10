/**
 * `OlePptxElement` -> `WAnyShape` conversion, split out of
 * `element-to-write-model.ts` to stay under this repo's 300-LOC file budget.
 *
 * @module ppt/writer/ole-element-convert
 */

import type { OlePptxElement } from '../../types';
import { parseDataUrlToBytes } from '../../utils/data-url-utils';
import { elementRectEmu } from './element-rect';
import type { ConvertContext } from './element-to-write-model';
import { degradeElement } from './element-to-write-model';
import { dataUrlToPicture } from './raster-utils';
import type { WAnyShape } from './write-model';

/**
 * Convert an embedded OLE object: its picture-frame preview (PNG/JPEG,
 * required for ANY visible representation) plus, when the raw embedded
 * payload is also available, a real `WOleEmbed` wrapping it (see
 * `ole-writer.ts`) so it opens as a genuine OLE object in PowerPoint rather
 * than degrading to a static picture.
 */
export function convertOle(element: OlePptxElement, ctx: ConvertContext): WAnyShape {
	const picture = dataUrlToPicture(element.previewImageData ?? element.previewImage);
	if (!picture) {
		return degradeElement(element, ctx, element.fileName ?? '[Embedded Object]');
	}
	ctx.pictures.push(picture);
	const label = element.oleEmbeddedFileName ?? element.fileName ?? 'Object';
	const parsed = element.oleEmbeddedData ? parseDataUrlToBytes(element.oleEmbeddedData) : null;
	if (!parsed || parsed.bytes.length === 0) {
		ctx.report({
			code: 'ppt-ole-embedding-unavailable',
			message:
				'OLE object has a preview image but no recoverable embedded payload, so it was written as a static picture instead of a real OLE object.',
			severity: 'warning',
			scope: 'element',
			slideId: ctx.slideId,
			elementId: element.id,
		});
		return {
			kind: 'picture',
			pictureIndex: ctx.pictures.length - 1,
			name: element.name,
			anchor: elementRectEmu(element),
			rotationDeg: element.rotation,
			flipH: element.flipHorizontal,
			flipV: element.flipVertical,
		};
	}
	return {
		kind: 'picture',
		pictureIndex: ctx.pictures.length - 1,
		name: element.name,
		anchor: elementRectEmu(element),
		rotationDeg: element.rotation,
		flipH: element.flipHorizontal,
		flipV: element.flipVertical,
		ole: { data: parsed.bytes, label },
	};
}
