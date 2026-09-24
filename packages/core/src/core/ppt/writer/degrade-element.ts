/**
 * Fallback conversion for elements with no plain binary-`.ppt` record form
 * (chart, smartArt, ink, contentPart, model3d, zoom, unknown, plus media/OLE
 * elements their own converters cannot embed).
 *
 * The shape is written as the element's rasterised preview picture when one
 * is available (PNG/JPEG only, see `raster-utils.ts`), otherwise as a
 * labelled placeholder rectangle. For ink, SmartArt, charts and 3D models the
 * shape also carries a `metroBlob` (see `metro-blob-package.ts`) when one was
 * built for the element, which PowerPoint 2007 and later reopen as the native,
 * editable object; only a 97-2003-era reader then sees the fallback. Either
 * way a `PptxCompatibilityWarning` (`scope: 'element'`) is reported, never
 * silent.
 *
 * @module ppt/writer/degrade-element
 */

import type { PptxElement } from '../../types';
import { elementRectEmu } from './element-rect';
import type { ConvertContext } from './element-to-write-model';
import { dataUrlToPicture } from './raster-utils';
import type { WAnyShape, WShape } from './write-model';

/** Build a labelled placeholder rectangle for an element with no binary-`.ppt` form. */
export function placeholderShape(element: PptxElement, label: string): WShape {
	return {
		kind: 'shape',
		spt: 1,
		isConnector: false,
		name: element.name,
		anchor: elementRectEmu(element),
		rotationDeg: element.rotation,
		fill: { kind: 'solid', rgb: 'F2F2F2' },
		line: { kind: 'line', rgb: 'BFBFBF', widthEmu: 9525 },
		text: {
			textType: 4,
			paragraphs: [{ indentLevel: 0, align: 'ctr', runs: [{ text: label, sizePt: 12 }] }],
		},
	};
}

function fallbackDescription(hasPicture: boolean): string {
	return hasPicture ? 'a static preview image' : 'a placeholder rectangle';
}

/** Convert an element with no binary-`.ppt` equivalent to a preview picture or placeholder. */
export function degradeElement(
	element: PptxElement,
	ctx: ConvertContext,
	label: string,
): WAnyShape {
	const preview =
		(element as { previewImageData?: string; posterImage?: string }).previewImageData ??
		(element as { posterImage?: string }).posterImage;
	const picture = dataUrlToPicture(preview);
	const metroBlob = ctx.metroBlobs?.get(element.id);
	ctx.report(
		metroBlob
			? {
					code: `ppt-native-roundtrip-${element.type}`,
					message: `"${element.type}" element written with its OOXML round-trip package: PowerPoint 2007 and later reopen it as an editable ${element.type}, while PowerPoint 97-2003 shows ${fallbackDescription(
						Boolean(picture),
					)}.`,
					severity: 'info',
					scope: 'element',
					slideId: ctx.slideId,
					elementId: element.id,
				}
			: {
					code: `ppt-unsupported-${element.type}`,
					message: `"${element.type}" elements have no binary .ppt equivalent; ${fallbackDescription(
						Boolean(picture),
					)} was written instead.`,
					severity: 'warning',
					scope: 'element',
					slideId: ctx.slideId,
					elementId: element.id,
				},
	);
	if (picture) {
		ctx.pictures.push(picture);
		return {
			kind: 'picture',
			pictureIndex: ctx.pictures.length - 1,
			name: element.name,
			anchor: elementRectEmu(element),
			rotationDeg: element.rotation,
			metroBlob,
		};
	}
	return { ...placeholderShape(element, label), metroBlob };
}
