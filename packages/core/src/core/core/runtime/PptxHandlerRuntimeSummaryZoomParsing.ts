import type { PptxElement, SummaryZoomTarget, XmlObject, ZoomPptxElement } from '../../types';
import { extractSectionMap } from '../../utils/presentation-section-parser';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSectionZoomParsing';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Parse an Office 2016 Summary Zoom container and all section tiles. */
	protected async parseSummaryZoomElement(
		zoom: XmlObject,
		id: string,
		slidePath: string,
	): Promise<PptxElement | null> {
		try {
			const sectionMap = extractSectionMap(this.presentationData, this.xmlLookupService);
			const objects = this.ensureArray(zoom['psuz:summaryZmObj']) as XmlObject[];
			const targets: SummaryZoomTarget[] = [];
			for (const object of objects) {
				const sectionId = String(object['@_sectionId'] ?? '').trim();
				const section = sectionMap.orderedSections.find((item) => item.id === sectionId);
				const targetSlideIndex = this.findSlideIndexByNumericId(section?.slideIds[0]);
				const properties = object['psuz:zmPr'] as XmlObject | undefined;
				const shapeProperties = properties?.['p166:spPr'] as XmlObject | undefined;
				const transform = shapeProperties?.['a:xfrm'] as XmlObject | undefined;
				const offset = transform?.['a:off'] as XmlObject | undefined;
				const extent = transform?.['a:ext'] as XmlObject | undefined;
				if (!sectionId || targetSlideIndex < 0 || !offset || !extent) {
					continue;
				}
				const image = await this.parseSummaryZoomPreview(properties, slidePath);
				const emu = PptxHandlerRuntime.EMU_PER_PX;
				targets.push({
					sectionId,
					targetSlideIndex,
					x: Number(offset['@_x'] ?? 0) / emu,
					y: Number(offset['@_y'] ?? 0) / emu,
					width: Number(extent['@_cx'] ?? 0) / emu,
					height: Number(extent['@_cy'] ?? 0) / emu,
					title: String(object['@_title'] ?? '') || undefined,
					description: String(object['@_descr'] ?? '') || undefined,
					offsetFactorX: this.optionalNumber(object['@_offsetFactorX']),
					offsetFactorY: this.optionalNumber(object['@_offsetFactorY']),
					scaleFactorX: this.optionalNumber(object['@_scaleFactorX']),
					scaleFactorY: this.optionalNumber(object['@_scaleFactorY']),
					...image,
					rawXml: object,
				});
			}
			if (targets.length === 0) {
				return null;
			}
			const left = Math.min(...targets.map((target) => target.x));
			const top = Math.min(...targets.map((target) => target.y));
			const right = Math.max(...targets.map((target) => target.x + target.width));
			const bottom = Math.max(...targets.map((target) => target.y + target.height));
			const first = targets[0];
			const result: ZoomPptxElement = {
				id,
				type: 'zoom',
				zoomType: 'summary',
				targetSlideIndex: first.targetSlideIndex,
				targetSectionId: first.sectionId,
				x: left,
				y: top,
				width: right - left,
				height: bottom - top,
				imagePath: first.imagePath,
				imageData: first.imageData,
				summaryTargets: targets,
				summaryLayout: zoom['psuz:fixedLayout'] !== undefined ? 'fixed' : 'grid',
				rawXml: zoom,
			};
			return result;
		} catch (error) {
			console.warn('Skipping malformed Summary Zoom element:', error);
			return null;
		}
	}

	private async parseSummaryZoomPreview(
		properties: XmlObject | undefined,
		slidePath: string,
	): Promise<Pick<SummaryZoomTarget, 'imagePath' | 'imageData'>> {
		const blipFill = properties?.['p166:blipFill'] as XmlObject | undefined;
		const blip = blipFill?.['a:blip'] as XmlObject | undefined;
		const relationshipId = String(blip?.['@_r:embed'] ?? blip?.['@_r:link'] ?? '').trim();
		const target = relationshipId
			? this.slideRelsMap.get(slidePath)?.get(relationshipId)
			: undefined;
		if (!target) {
			return {};
		}
		const imagePath = this.resolveImagePath(slidePath, target);
		const imageData =
			this.eagerDecodeImages && imagePath ? await this.getImageData(imagePath) : undefined;
		return { imagePath, imageData };
	}

	private optionalNumber(value: unknown): number | undefined {
		if (value === undefined) {
			return undefined;
		}
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
}
