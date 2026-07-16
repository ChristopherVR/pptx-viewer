import type { ContentPartPptxElement, InkPptxElement, XmlObject } from '../../types';
import { buildInkMlContent } from '../../utils';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveModel3D';

const CUSTOM_XML_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml';
const A14_NAMESPACE = 'http://schemas.microsoft.com/office/drawing/2010/main';
const MC_NAMESPACE = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	private readonly newContentPartFallbackByXml = new Map<XmlObject, XmlObject>();

	/** Author or update a p:contentPart and its related InkML package part. */
	protected createOrUpdateContentPartInkXml(
		el: ContentPartPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		if (!el.inkStrokes?.length) {
			if (shape) {
				this.applyContentPartTransform(shape, el);
			}
			return shape;
		}
		let relationshipId = String(shape?.['@_r:id'] ?? '').trim() || undefined;
		let inkPath = el.inkPartPath ?? this.inkPathForRelationship(ctx, relationshipId);
		if (!inkPath) {
			inkPath = ctx.saveSession.nextInkPath();
		} else {
			ctx.saveSession.activateInkPath(inkPath);
		}
		relationshipId ??= ctx.slideRelationshipRegistry.nextRelationshipId();
		ctx.slideRelationshipRegistry.upsertRelationship(
			relationshipId,
			CUSTOM_XML_RELATIONSHIP_TYPE,
			inkPath.replace(/^ppt\//u, '../'),
		);
		const inkData = buildInkMlContent(el.inkStrokes, el.inkPartRawXml);
		this.zip.file(inkPath, this.builder.build(inkData));
		el.inkPartPath = inkPath;
		el.inkPartRawXml = inkData;

		if (!shape) {
			shape = this.buildContentPartXml(el, relationshipId);
			this.newContentPartFallbackByXml.set(shape, this.buildContentPartFallback(el));
			el.rawXml = shape;
			return shape;
		}
		shape['@_r:id'] = relationshipId;
		this.applyContentPartTransform(shape, el);
		this.updateContentPartFallback(shape, el);
		return shape;
	}

	/** Wrap newly authored content parts with a visible shape fallback. */
	protected wrapNewContentPartEnvelopes(
		spTree: XmlObject,
		contentParts: readonly XmlObject[],
	): void {
		const envelopes: XmlObject[] = [];
		for (const part of contentParts) {
			const fallback = this.newContentPartFallbackByXml.get(part);
			if (!fallback || this.alternateContentBlockByRawXml.has(part)) {
				continue;
			}
			envelopes.push({
				'@_xmlns:mc': MC_NAMESPACE,
				'mc:Choice': {
					'@_Requires': 'a14',
					'@_xmlns:a14': A14_NAMESPACE,
					'p:contentPart': part,
				},
				'mc:Fallback': { 'p:sp': fallback },
			});
		}
		if (envelopes.length === 0) {
			return;
		}
		delete spTree['p:contentPart'];
		const existing = this.ensureArray(spTree['mc:AlternateContent']) as XmlObject[];
		spTree['mc:AlternateContent'] = [...existing, ...envelopes];
	}

	private inkPathForRelationship(
		ctx: SaveSlideContext,
		relationshipId: string | undefined,
	): string | undefined {
		if (!relationshipId) {
			return undefined;
		}
		const relationship = ctx.slideRelationships.find(
			(entry) => String(entry['@_Id'] ?? '') === relationshipId,
		);
		const target = String(relationship?.['@_Target'] ?? '');
		if (target.startsWith('../')) {
			return `ppt/${target.slice(3)}`;
		}
		return target.startsWith('ppt/') ? target : undefined;
	}

	private buildContentPartXml(el: ContentPartPptxElement, relationshipId: string): XmlObject {
		const result: XmlObject = {
			'@_r:id': relationshipId,
			'p:nvContentPartPr': {
				'p:cNvPr': { '@_id': el.shapeId ?? '2', '@_name': el.name || el.id },
				'p:cNvContentPartPr': {},
				'p:nvPr': {},
			},
			'p:xfrm': {},
		};
		this.applyContentPartTransform(result, el);
		return result;
	}

	private applyContentPartTransform(shape: XmlObject, el: ContentPartPptxElement): void {
		const emu = PptxHandlerRuntime.EMU_PER_PX;
		const transform = (shape['p:xfrm'] ??= {}) as XmlObject;
		transform['a:off'] = {
			'@_x': String(Math.round(el.x * emu)),
			'@_y': String(Math.round(el.y * emu)),
		};
		transform['a:ext'] = {
			'@_cx': String(Math.round(Math.max(el.width, 1) * emu)),
			'@_cy': String(Math.round(Math.max(el.height, 1) * emu)),
		};
	}

	private buildContentPartFallback(el: ContentPartPptxElement): XmlObject {
		return this.createInkShapeXml(this.asInkElement(el));
	}

	private updateContentPartFallback(shape: XmlObject, el: ContentPartPptxElement): void {
		const block = this.alternateContentBlockByRawXml.get(shape);
		const fallback = block?.rawAc['mc:Fallback'] as XmlObject | undefined;
		if (fallback) {
			fallback['p:sp'] = this.buildContentPartFallback(el);
		}
	}

	private asInkElement(el: ContentPartPptxElement): InkPptxElement {
		return {
			...el,
			type: 'ink',
			inkPaths: el.inkStrokes?.map((stroke) => stroke.path) ?? [],
			inkColors: el.inkStrokes?.map((stroke) => stroke.color),
			inkWidths: el.inkStrokes?.map((stroke) => stroke.width),
			inkOpacities: el.inkStrokes?.map((stroke) => stroke.opacity),
			inkPointPressures: el.inkStrokes?.map((stroke) => stroke.pressures ?? []),
		};
	}
}
