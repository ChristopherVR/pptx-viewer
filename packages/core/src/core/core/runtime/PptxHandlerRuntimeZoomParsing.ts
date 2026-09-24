import type { PptxElement, XmlObject, ZoomPptxElement } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeElementParsing';

function readBoolean(value: unknown): boolean | undefined {
	if (value === undefined) {
		return undefined;
	}
	return String(value) !== '0' && String(value).toLowerCase() !== 'false';
}

/**
 * `zmPr/@transitionDur` is an MS-PPTX `ST_UniversalTimeOffset`, whose full
 * TIMEOFFSET grammar allows a unit suffix (`5s`, `500ms`, defaulting to
 * milliseconds when bare). PowerPoint's own writer, like every other
 * `ST_UniversalTimeOffset` attribute this codebase parses (media trim/fade),
 * has only ever been observed to emit a bare decimal-millisecond value, so
 * this follows that same convention rather than the full grammar.
 */
function readOptionalMs(value: unknown): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	const parsed = parseFloat(String(value));
	return Number.isFinite(parsed) ? parsed : undefined;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Parse an Office 2016 `pslz:sldZm` slide Zoom object. */
	protected async parseSlideZoomElement(
		zoom: XmlObject,
		id: string,
		slidePath: string,
	): Promise<PptxElement | null> {
		try {
			const zoomObject = zoom['pslz:sldZmObj'] as XmlObject | undefined;
			const zoomProperties = zoomObject?.['pslz:zmPr'] as XmlObject | undefined;
			const shapeProperties = zoomProperties?.['p166:spPr'] as XmlObject | undefined;
			const transform = shapeProperties?.['a:xfrm'] as XmlObject | undefined;
			const offset = transform?.['a:off'] as XmlObject | undefined;
			const extent = transform?.['a:ext'] as XmlObject | undefined;
			const targetSlideIndex = this.findSlideIndexByNumericId(zoomObject?.['@_sldId']);
			if (!zoomObject || !zoomProperties || !offset || !extent || targetSlideIndex < 0) {
				return null;
			}

			const blipFill = zoomProperties['p166:blipFill'] as XmlObject | undefined;
			const blip = blipFill?.['a:blip'] as XmlObject | undefined;
			const relationshipId = String(blip?.['@_r:embed'] ?? blip?.['@_r:link'] ?? '').trim();
			let imagePath: string | undefined;
			let imageData: string | undefined;
			if (relationshipId) {
				const target = this.slideRelsMap.get(slidePath)?.get(relationshipId);
				if (target) {
					imagePath = this.resolveImagePath(slidePath, target);
					if (this.eagerDecodeImages && imagePath) {
						imageData = await this.getImageData(imagePath);
					}
				}
			}

			const emu = PptxHandlerRuntime.EMU_PER_PX;
			const result: ZoomPptxElement = {
				id,
				type: 'zoom',
				zoomType: 'slide',
				targetSlideIndex,
				x: Number(offset['@_x'] ?? 0) / emu,
				y: Number(offset['@_y'] ?? 0) / emu,
				width: Number(extent['@_cx'] ?? 0) / emu,
				height: Number(extent['@_cy'] ?? 0) / emu,
				rotation:
					transform?.['@_rot'] !== undefined ? Number(transform['@_rot']) / 60000 : undefined,
				flipHorizontal: readBoolean(transform?.['@_flipH']),
				flipVertical: readBoolean(transform?.['@_flipV']),
				imagePath,
				imageData,
				...this.parseZoomObjectProperties(zoomProperties),
				rawXml: zoom,
			};
			return result;
		} catch (error) {
			console.warn('Skipping malformed slide Zoom element:', error);
			return null;
		}
	}

	protected findSlideIndexByNumericId(value: unknown): number {
		const presentation = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		const list = presentation?.['p:sldIdLst'] as XmlObject | undefined;
		const entries = this.ensureArray(list?.['p:sldId']) as XmlObject[];
		const target = String(value ?? '').trim();
		return entries.findIndex((entry) => String(entry['@_id'] ?? '').trim() === target);
	}

	/**
	 * Read `zmPr/@returnToParent` and `zmPr/@transitionDur`: MS-PPTX
	 * `CT_ZoomObjectProperties` attributes shared by all three Zoom kinds
	 * (`pslz:zmPr`, `psezm:zmPr`, `psuz:zmPr` each reference the same complex
	 * type), so one reader serves the slide/section/summary parsers below via
	 * inheritance rather than being copied three times.
	 */
	protected parseZoomObjectProperties(
		zoomProperties: XmlObject,
	): Pick<ZoomPptxElement, 'returnToParent' | 'transitionDurationMs'> {
		return {
			returnToParent: readBoolean(zoomProperties['@_returnToParent']),
			transitionDurationMs: readOptionalMs(zoomProperties['@_transitionDur']),
		};
	}
}
