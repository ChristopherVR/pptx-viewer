import type { SummaryZoomTarget, XmlObject, ZoomPptxElement } from '../../types';
import { generateFontGuid } from '../../utils/font-deobfuscation';
import { extractSectionMap } from '../../utils/presentation-section-parser';
import { ensureXmlChildOrCreate, xmlHasChild } from '../../utils/xml-access';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSectionZoom';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Dispatch Summary Zoom containers without conflating them with Section Zoom tiles. */
	protected override createOrUpdateZoomXml(
		el: ZoomPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		if (el.zoomType !== 'summary') {
			return super.createOrUpdateZoomXml(el, shape, ctx);
		}
		return this.createOrUpdateSummaryZoomXml(el, shape, ctx);
	}

	private createOrUpdateSummaryZoomXml(
		el: ZoomPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		const targets = el.summaryTargets ?? [];
		if (targets.length === 0) {
			return undefined;
		}
		this.ensureZoomShapeId(el, ctx);
		const existing = this.ensureArray(shape?.['psuz:summaryZmObj']) as XmlObject[];
		const relationships: Array<string | undefined> = [];
		const objects: XmlObject[] = [];

		for (const [index, target] of targets.entries()) {
			const sectionId = this.resolveSummarySectionId(target);
			if (!sectionId) {
				continue;
			}
			const object = target.rawXml ?? existing[index] ?? {};
			const properties = ensureXmlChildOrCreate(object, 'psuz:zmPr');
			const tile = this.summaryTileElement(el, target, index);
			const relationshipShape = {
				'psezm:sectionZmObj': { 'psezm:zmPr': properties },
			};
			const relationshipId = this.ensureZoomPreviewRelationship(tile, relationshipShape, ctx);
			object['@_sectionId'] = sectionId;
			this.applyOptionalAttribute(object, '@_title', target.title);
			this.applyOptionalAttribute(object, '@_descr', target.description);
			this.applyOptionalAttribute(object, '@_offsetFactorX', target.offsetFactorX);
			this.applyOptionalAttribute(object, '@_offsetFactorY', target.offsetFactorY);
			this.applyOptionalAttribute(object, '@_scaleFactorX', target.scaleFactorX);
			this.applyOptionalAttribute(object, '@_scaleFactorY', target.scaleFactorY);
			properties['@_id'] ??= `{${generateFontGuid()}}`;
			properties['@_imageType'] ??= 'preview';
			// `??=` cannot heal a bare `<p166:blipFill/>` / `<p166:spPr/>`: `''` is
			// not nullish, so the string survived and the transform written onto
			// it threw. `xmlHasChild` asks the only question that matters here -
			// did the author write the element at all - and leaves an authored
			// node untouched.
			if (!xmlHasChild(properties, 'p166:blipFill')) {
				properties['p166:blipFill'] = this.buildZoomBlipFill(relationshipId);
			}
			const shapeProperties = xmlHasChild(properties, 'p166:spPr')
				? ensureXmlChildOrCreate(properties, 'p166:spPr')
				: ((properties['p166:spPr'] = this.buildZoomShapeProperties(tile)) as XmlObject);
			this.applyZoomTransform(shapeProperties, tile);
			this.applyZoomBlipRelationship(properties, relationshipId);
			target.sectionId = sectionId;
			target.imagePath = tile.imagePath;
			target.rawXml = object;
			relationships.push(relationshipId);
			objects.push(object);
		}

		if (objects.length === 0) {
			return undefined;
		}
		shape ??= {};
		shape['psuz:summaryZmObj'] = objects;
		const layout = el.summaryLayout === 'fixed' ? 'psuz:fixedLayout' : 'psuz:gridLayout';
		delete shape[layout === 'psuz:gridLayout' ? 'psuz:fixedLayout' : 'psuz:gridLayout'];
		shape[layout] ??= {};
		this.updateSummaryFallback(shape, el, targets, relationships);
		if (!this.alternateContentBlockByRawXml.has(shape)) {
			this.newZoomFallbackByXml.set(
				shape,
				this.buildSummaryFallbackGroup(el, targets, relationships),
			);
		}
		return shape;
	}

	private summaryTileElement(
		el: ZoomPptxElement,
		target: SummaryZoomTarget,
		index: number,
	): ZoomPptxElement {
		return {
			...el,
			id: `${el.id}-tile-${index + 1}`,
			shapeId: String(Number.parseInt(el.shapeId ?? '2', 10) + index + 1),
			zoomType: 'section',
			targetSlideIndex: target.targetSlideIndex,
			targetSectionId: target.sectionId,
			x: target.x,
			y: target.y,
			width: target.width,
			height: target.height,
			imagePath: target.imagePath,
			imageData: target.imageData,
			altText: target.description,
		};
	}

	private resolveSummarySectionId(target: SummaryZoomTarget): string | undefined {
		if (target.sectionId) {
			return target.sectionId;
		}
		const presentation = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		const slideList = presentation?.['p:sldIdLst'] as XmlObject | undefined;
		const slides = this.ensureArray(slideList?.['p:sldId']) as XmlObject[];
		const slideId = String(slides[target.targetSlideIndex]?.['@_id'] ?? '');
		return extractSectionMap(this.presentationData, this.xmlLookupService).sectionBySlideId.get(
			slideId,
		)?.sectionId;
	}

	private updateSummaryFallback(
		shape: XmlObject,
		el: ZoomPptxElement,
		targets: readonly SummaryZoomTarget[],
		relationships: readonly (string | undefined)[],
	): void {
		const block = this.alternateContentBlockByRawXml.get(shape);
		const fallback = block?.rawAc['mc:Fallback'] as XmlObject | undefined;
		const group = fallback?.['p:grpSp'] as XmlObject | undefined;
		if (!group) {
			return;
		}
		const existing = this.ensureArray(group['p:pic']) as XmlObject[];
		group['p:pic'] = targets.map((target, index) => {
			const tile = this.summaryTileElement(el, target, index);
			const picture = existing[index] ?? this.buildZoomFallbackPicture(tile, relationships[index]);
			this.applyZoomTransform(ensureXmlChildOrCreate(picture, 'p:spPr'), tile);
			if (relationships[index]) {
				const fill = ensureXmlChildOrCreate(picture, 'p:blipFill');
				const blip = ensureXmlChildOrCreate(fill, 'a:blip');
				blip['@_r:embed'] = relationships[index];
			}
			return picture;
		});
	}

	private buildSummaryFallbackGroup(
		el: ZoomPptxElement,
		targets: readonly SummaryZoomTarget[],
		relationships: readonly (string | undefined)[],
	): XmlObject {
		const shapeId = String(el.shapeId ?? 2);
		return {
			'p:nvGrpSpPr': {
				'p:cNvPr': { '@_id': shapeId, '@_name': el.name || el.id },
				'p:cNvGrpSpPr': {},
				'p:nvPr': {},
			},
			'p:grpSpPr': {
				'a:xfrm': {
					'a:off': this.summaryPoint(el.x, el.y),
					'a:ext': this.summaryExtent(el.width, el.height),
					'a:chOff': this.summaryPoint(el.x, el.y),
					'a:chExt': this.summaryExtent(el.width, el.height),
				},
			},
			'p:pic': targets.map((target, index) =>
				this.buildZoomFallbackPicture(
					this.summaryTileElement(el, target, index),
					relationships[index],
				),
			),
		};
	}

	private summaryPoint(x: number, y: number): XmlObject {
		return {
			'@_x': String(Math.round(x * PptxHandlerRuntime.EMU_PER_PX)),
			'@_y': String(Math.round(y * PptxHandlerRuntime.EMU_PER_PX)),
		};
	}

	private summaryExtent(width: number, height: number): XmlObject {
		return {
			'@_cx': String(Math.round(Math.max(width, 1) * PptxHandlerRuntime.EMU_PER_PX)),
			'@_cy': String(Math.round(Math.max(height, 1) * PptxHandlerRuntime.EMU_PER_PX)),
		};
	}

	private applyOptionalAttribute(
		object: XmlObject,
		name: string,
		value: string | number | undefined,
	): void {
		if (value === undefined || value === '') {
			delete object[name];
		} else {
			object[name] = String(value);
		}
	}
}
