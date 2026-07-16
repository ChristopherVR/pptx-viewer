import type { XmlObject, ZoomPptxElement } from '../../types';
import { generateFontGuid } from '../../utils/font-deobfuscation';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveInk';

const SLIDE_ZOOM_NAMESPACE = 'http://schemas.microsoft.com/office/powerpoint/2016/slidezoom';
const SECTION_ZOOM_NAMESPACE = 'http://schemas.microsoft.com/office/powerpoint/2016/sectionzoom';
const SUMMARY_ZOOM_NAMESPACE = 'http://schemas.microsoft.com/office/powerpoint/2016/summaryzoom';
const POWERPOINT_2016_NAMESPACE = 'http://schemas.microsoft.com/office/powerpoint/2016/6/main';
const MC_NAMESPACE = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected readonly newZoomFallbackByXml = new Map<XmlObject, XmlObject>();

	/** Update an existing slide Zoom or build a new Office 2016 Zoom node. */
	protected createOrUpdateSlideZoomXml(
		el: ZoomPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		if (el.zoomType !== 'slide') {
			return shape;
		}
		const targetSlideId = this.numericSlideIdAt(el.targetSlideIndex);
		if (!targetSlideId) {
			return undefined;
		}
		const relationshipId = this.ensureZoomPreviewRelationship(el, shape, ctx);
		if (!shape) {
			this.ensureZoomShapeId(el, ctx);
			shape = this.buildSlideZoomXml(el, targetSlideId, relationshipId);
			this.newZoomFallbackByXml.set(shape, this.buildZoomFallbackPicture(el, relationshipId));
			return shape;
		}

		const zoomObject = shape['pslz:sldZmObj'] as XmlObject | undefined;
		const zoomProperties = zoomObject?.['pslz:zmPr'] as XmlObject | undefined;
		const shapeProperties = zoomProperties?.['p166:spPr'] as XmlObject | undefined;
		if (!zoomObject || !zoomProperties || !shapeProperties) {
			return undefined;
		}
		zoomObject['@_sldId'] = targetSlideId;
		this.applyZoomTransform(shapeProperties, el);
		this.applyZoomBlipRelationship(zoomProperties, relationshipId);
		this.updateZoomFallback(shape, el, relationshipId);
		return shape;
	}

	/** Wrap SDK-created Zoom nodes in their required Choice/Fallback envelope. */
	protected wrapNewZoomEnvelopes(spTree: XmlObject, zooms: readonly XmlObject[]): void {
		const newEnvelopes: XmlObject[] = [];
		for (const zoom of zooms) {
			const fallback = this.newZoomFallbackByXml.get(zoom);
			if (!fallback || this.alternateContentBlockByRawXml.has(zoom)) {
				continue;
			}
			const summaryZoom = zoom['psuz:summaryZmObj'] !== undefined;
			const sectionZoom = !summaryZoom && Boolean(zoom['psezm:sectionZmObj']);
			const prefix = summaryZoom ? 'psuz' : sectionZoom ? 'psezm' : 'pslz';
			const tag = summaryZoom ? 'psuz:summaryZm' : sectionZoom ? 'psezm:sectionZm' : 'pslz:sldZm';
			const choice: XmlObject = {
				'@_Requires': prefix,
				'@_xmlns:p166': POWERPOINT_2016_NAMESPACE,
			};
			choice[`@_xmlns:${prefix}`] = summaryZoom
				? SUMMARY_ZOOM_NAMESPACE
				: sectionZoom
					? SECTION_ZOOM_NAMESPACE
					: SLIDE_ZOOM_NAMESPACE;
			choice[tag] = zoom;
			const fallbackBranch: XmlObject = {};
			fallbackBranch[summaryZoom ? 'p:grpSp' : 'p:pic'] = fallback;
			newEnvelopes.push({
				'@_xmlns:mc': MC_NAMESPACE,
				'mc:Choice': choice,
				'mc:Fallback': fallbackBranch,
			});
		}
		if (newEnvelopes.length === 0) {
			return;
		}
		delete spTree['pslz:sldZm'];
		delete spTree['psezm:sectionZm'];
		delete spTree['psuz:summaryZm'];
		const existing = this.ensureArray(spTree['mc:AlternateContent']) as XmlObject[];
		spTree['mc:AlternateContent'] = [...existing, ...newEnvelopes];
	}

	private numericSlideIdAt(index: number): string | undefined {
		const presentation = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		const list = presentation?.['p:sldIdLst'] as XmlObject | undefined;
		const entries = this.ensureArray(list?.['p:sldId']) as XmlObject[];
		const value = entries[index]?.['@_id'];
		return value === undefined ? undefined : String(value);
	}

	protected ensureZoomShapeId(el: ZoomPptxElement, ctx: SaveSlideContext): void {
		if (el.shapeId !== undefined) {
			return;
		}
		let max = 1;
		for (const element of ctx.slide.elements) {
			if (element !== el && element.shapeId !== undefined) {
				const numericId = Number.parseInt(element.shapeId, 10);
				if (Number.isFinite(numericId)) {
					max = Math.max(max, numericId);
				}
			}
		}
		el.shapeId = String(max + 1);
	}

	protected ensureZoomPreviewRelationship(
		el: ZoomPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): string | undefined {
		const slideZoomObject = shape?.['pslz:sldZmObj'] as XmlObject | undefined;
		const sectionZoomObject = shape?.['psezm:sectionZmObj'] as XmlObject | undefined;
		const zoomProperties = (slideZoomObject?.['pslz:zmPr'] ?? sectionZoomObject?.['psezm:zmPr']) as
			| XmlObject
			| undefined;
		const blip = (zoomProperties?.['p166:blipFill'] as XmlObject | undefined)?.['a:blip'] as
			| XmlObject
			| undefined;
		let relationshipId = String(blip?.['@_r:embed'] ?? '').trim() || undefined;
		let imagePath = el.imagePath;
		if (typeof el.imageData === 'string') {
			const parsed = this.parseDataUrlToBytes(el.imageData);
			if (parsed) {
				imagePath ??= ctx.saveSession.nextMediaPath(parsed.extension);
				this.zip.file(imagePath, parsed.bytes);
			}
		}
		if (!imagePath) {
			return relationshipId;
		}
		relationshipId ??= ctx.slideRelationshipRegistry.nextRelationshipId();
		ctx.slideRelationshipRegistry.upsertRelationship(
			relationshipId,
			ctx.slideImageRelationshipType,
			imagePath.replace(/^ppt\//u, '../'),
		);
		el.imagePath = imagePath;
		return relationshipId;
	}

	private buildSlideZoomXml(
		el: ZoomPptxElement,
		targetSlideId: string,
		relationshipId: string | undefined,
	): XmlObject {
		const zoomProperties: XmlObject = {
			'@_id': `{${generateFontGuid()}}`,
			'@_imageType': 'preview',
			'p166:blipFill': this.buildZoomBlipFill(relationshipId),
			'p166:spPr': this.buildZoomShapeProperties(el),
		};
		return {
			'pslz:sldZmObj': {
				'@_sldId': targetSlideId,
				'pslz:zmPr': zoomProperties,
			},
		};
	}

	protected buildZoomBlipFill(relationshipId: string | undefined): XmlObject {
		return {
			'a:blip': relationshipId ? { '@_r:embed': relationshipId } : {},
			'a:stretch': { 'a:fillRect': {} },
		};
	}

	protected buildZoomShapeProperties(el: ZoomPptxElement): XmlObject {
		const result: XmlObject = {
			'a:xfrm': {},
			'a:prstGeom': { '@_prst': 'rect', 'a:avLst': {} },
		};
		this.applyZoomTransform(result, el);
		return result;
	}

	protected applyZoomTransform(shapeProperties: XmlObject, el: ZoomPptxElement): void {
		const emu = PptxHandlerRuntime.EMU_PER_PX;
		const transform = (shapeProperties['a:xfrm'] ??= {}) as XmlObject;
		transform['a:off'] = {
			'@_x': String(Math.round(el.x * emu)),
			'@_y': String(Math.round(el.y * emu)),
		};
		transform['a:ext'] = {
			'@_cx': String(Math.round(Math.max(el.width, 1) * emu)),
			'@_cy': String(Math.round(Math.max(el.height, 1) * emu)),
		};
		if (el.rotation !== undefined) {
			transform['@_rot'] = String(Math.round(el.rotation * 60000));
		}
		if (el.flipHorizontal) {
			transform['@_flipH'] = '1';
		} else {
			delete transform['@_flipH'];
		}
		if (el.flipVertical) {
			transform['@_flipV'] = '1';
		} else {
			delete transform['@_flipV'];
		}
	}

	protected applyZoomBlipRelationship(
		zoomProperties: XmlObject,
		relationshipId: string | undefined,
	): void {
		if (!relationshipId) {
			return;
		}
		const blipFill = (zoomProperties['p166:blipFill'] ??= {}) as XmlObject;
		const blip = (blipFill['a:blip'] ??= {}) as XmlObject;
		blip['@_r:embed'] = relationshipId;
	}

	protected updateZoomFallback(
		shape: XmlObject,
		el: ZoomPptxElement,
		relationshipId: string | undefined,
	): void {
		const block = this.alternateContentBlockByRawXml.get(shape);
		const fallback = block?.rawAc['mc:Fallback'] as XmlObject | undefined;
		const picture = fallback?.['p:pic'] as XmlObject | undefined;
		if (!picture) {
			return;
		}
		const shapeProperties = (picture['p:spPr'] ??= {}) as XmlObject;
		this.applyZoomTransform(shapeProperties, el);
		if (relationshipId) {
			const blipFill = (picture['p:blipFill'] ??= {}) as XmlObject;
			const blip = (blipFill['a:blip'] ??= {}) as XmlObject;
			blip['@_r:embed'] = relationshipId;
		}
	}

	protected buildZoomFallbackPicture(
		el: ZoomPptxElement,
		relationshipId: string | undefined,
	): XmlObject {
		return {
			'p:nvPicPr': {
				'p:cNvPr': {
					'@_id': String(el.shapeId ?? 2),
					'@_name': el.name || el.id,
					...(el.altText ? { '@_descr': el.altText } : {}),
				},
				'p:cNvPicPr': { 'a:picLocks': { '@_noChangeAspect': '1' } },
				'p:nvPr': {},
			},
			'p:blipFill': this.buildZoomBlipFill(relationshipId),
			'p:spPr': this.buildZoomShapeProperties(el),
		};
	}
}
