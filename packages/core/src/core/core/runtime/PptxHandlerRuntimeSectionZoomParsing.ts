import type { PptxElement, XmlObject, ZoomPptxElement } from '../../types';
import { extractSectionMap } from '../../utils/presentation-section-parser';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeZoomParsing';

function readBoolean(value: unknown): boolean | undefined {
	if (value === undefined) {
		return undefined;
	}
	return String(value) !== '0' && String(value).toLowerCase() !== 'false';
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Parse an Office 2016 `psezm:sectionZm` section Zoom object. */
	protected async parseSectionZoomElement(
		zoom: XmlObject,
		id: string,
		slidePath: string,
	): Promise<PptxElement | null> {
		try {
			const zoomObject = zoom['psezm:sectionZmObj'] as XmlObject | undefined;
			const sectionId = String(zoomObject?.['@_sectionId'] ?? '').trim();
			const section = extractSectionMap(
				this.presentationData,
				this.xmlLookupService,
			).orderedSections.find((item) => item.id === sectionId);
			const targetSlideIndex = this.findSlideIndexByNumericId(section?.slideIds[0]);
			const zoomProperties = zoomObject?.['psezm:zmPr'] as XmlObject | undefined;
			const shapeProperties = zoomProperties?.['p166:spPr'] as XmlObject | undefined;
			const transform = shapeProperties?.['a:xfrm'] as XmlObject | undefined;
			const offset = transform?.['a:off'] as XmlObject | undefined;
			const extent = transform?.['a:ext'] as XmlObject | undefined;
			if (!sectionId || !zoomProperties || !offset || !extent || targetSlideIndex < 0) {
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
				zoomType: 'section',
				targetSectionId: sectionId,
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
				rawXml: zoom,
			};
			return result;
		} catch (error) {
			console.warn('Skipping malformed section Zoom element:', error);
			return null;
		}
	}
}
