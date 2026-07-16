import type { XmlObject, ZoomPptxElement } from '../../types';
import { generateFontGuid } from '../../utils/font-deobfuscation';
import { extractSectionMap } from '../../utils/presentation-section-parser';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveZoom';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Dispatch typed Zoom elements to their distinct slide/section envelopes. */
	protected createOrUpdateZoomXml(
		el: ZoomPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		return el.zoomType === 'section'
			? this.createOrUpdateSectionZoomXml(el, shape, ctx)
			: this.createOrUpdateSlideZoomXml(el, shape, ctx);
	}

	private createOrUpdateSectionZoomXml(
		el: ZoomPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		const sectionId = this.resolveSectionId(el);
		if (!sectionId) {
			return undefined;
		}
		const relationshipId = this.ensureZoomPreviewRelationship(el, shape, ctx);
		if (!shape) {
			this.ensureZoomShapeId(el, ctx);
			shape = {
				'psezm:sectionZmObj': {
					'@_sectionId': sectionId,
					'psezm:zmPr': {
						'@_id': `{${generateFontGuid()}}`,
						'@_imageType': 'preview',
						'p166:blipFill': this.buildZoomBlipFill(relationshipId),
						'p166:spPr': this.buildZoomShapeProperties(el),
					},
				},
			};
			this.newZoomFallbackByXml.set(shape, this.buildZoomFallbackPicture(el, relationshipId));
			return shape;
		}

		const zoomObject = shape['psezm:sectionZmObj'] as XmlObject | undefined;
		const zoomProperties = zoomObject?.['psezm:zmPr'] as XmlObject | undefined;
		const shapeProperties = zoomProperties?.['p166:spPr'] as XmlObject | undefined;
		if (!zoomObject || !zoomProperties || !shapeProperties) {
			return undefined;
		}
		zoomObject['@_sectionId'] = sectionId;
		this.applyZoomTransform(shapeProperties, el);
		this.applyZoomBlipRelationship(zoomProperties, relationshipId);
		this.updateZoomFallback(shape, el, relationshipId);
		return shape;
	}

	private resolveSectionId(el: ZoomPptxElement): string | undefined {
		if (el.targetSectionId) {
			return el.targetSectionId;
		}
		const presentation = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		const slideList = presentation?.['p:sldIdLst'] as XmlObject | undefined;
		const slides = this.ensureArray(slideList?.['p:sldId']) as XmlObject[];
		const numericSlideId = String(slides[el.targetSlideIndex]?.['@_id'] ?? '');
		return extractSectionMap(this.presentationData, this.xmlLookupService).sectionBySlideId.get(
			numericSlideId,
		)?.sectionId;
	}
}
