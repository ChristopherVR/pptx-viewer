import type { Model3DPptxElement, XmlObject } from '../../types';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSummaryZoom';

const MODEL3D_RELATIONSHIP_TYPE =
	'http://schemas.microsoft.com/office/2017/06/relationships/model3d';
const MODEL3D_NAMESPACE = 'http://schemas.microsoft.com/office/powerpoint/2015/main';
const MC_NAMESPACE = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	private readonly newModel3DFallbackByXml = new Map<XmlObject, XmlObject>();

	/** Create or update an embedded GLB model, its poster, and package relationships. */
	protected createOrUpdateModel3DXml(
		el: Model3DPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		const existingModelRel = shape?.['p16:model3Drel'] as XmlObject | undefined;
		let modelRelationshipId = String(existingModelRel?.['@_r:id'] ?? '').trim() || undefined;
		let modelPath = el.modelPath;
		if (typeof el.modelData === 'string') {
			const parsed = this.parseDataUrlToBytes(el.modelData);
			if (!parsed) {
				return shape;
			}
			if (!modelPath?.toLowerCase().endsWith('.glb')) {
				modelPath = ctx.saveSession.nextMediaPath('glb');
			}
			this.zip.file(modelPath, parsed.bytes);
		}
		if (!modelPath) {
			return shape;
		}
		modelRelationshipId ??= ctx.slideRelationshipRegistry.nextRelationshipId();
		ctx.slideRelationshipRegistry.upsertRelationship(
			modelRelationshipId,
			MODEL3D_RELATIONSHIP_TYPE,
			modelPath.replace(/^ppt\//u, '../'),
		);
		el.modelPath = modelPath;
		el.modelMimeType = 'model/gltf-binary';

		const poster = this.ensureModel3DPoster(el, shape, ctx);
		if (!shape) {
			shape = {
				'p16:model3Drel': { '@_r:id': modelRelationshipId },
				'p16:spPr': this.buildModel3DShapeProperties(el),
				...(poster.relationshipId
					? { 'p16:posterImage': { '@_r:embed': poster.relationshipId } }
					: {}),
			};
			this.newModel3DFallbackByXml.set(
				shape,
				this.buildModel3DFallbackPicture(el, poster.relationshipId),
			);
			el.rawXml = shape;
			return shape;
		}

		(shape['p16:model3Drel'] ??= {}) as XmlObject;
		(shape['p16:model3Drel'] as XmlObject)['@_r:id'] = modelRelationshipId;
		const spPr = (shape['p16:spPr'] ??= {}) as XmlObject;
		this.applyModel3DTransform(spPr, el);
		if (poster.relationshipId) {
			const posterNode = (shape['p16:posterImage'] ??= {}) as XmlObject;
			posterNode['@_r:embed'] = poster.relationshipId;
			this.updateModel3DFallback(shape, el, poster.relationshipId);
		}
		return shape;
	}

	/** Wrap newly authored model nodes in the required Choice/Fallback envelope. */
	protected wrapNewModel3DEnvelopes(spTree: XmlObject, models: readonly XmlObject[]): void {
		const envelopes: XmlObject[] = [];
		for (const model of models) {
			const fallback = this.newModel3DFallbackByXml.get(model);
			if (!fallback || this.alternateContentBlockByRawXml.has(model)) {
				continue;
			}
			envelopes.push({
				'@_xmlns:mc': MC_NAMESPACE,
				'mc:Choice': {
					'@_Requires': 'p16',
					'@_xmlns:p16': MODEL3D_NAMESPACE,
					'p16:model3D': model,
				},
				'mc:Fallback': { 'p:pic': fallback },
			});
		}
		if (envelopes.length === 0) {
			return;
		}
		delete spTree['p16:model3D'];
		const existing = this.ensureArray(spTree['mc:AlternateContent']) as XmlObject[];
		spTree['mc:AlternateContent'] = [...existing, ...envelopes];
	}

	private ensureModel3DPoster(
		el: Model3DPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): { relationshipId?: string } {
		const posterNode = shape?.['p16:posterImage'] as XmlObject | undefined;
		let relationshipId = String(posterNode?.['@_r:embed'] ?? '').trim() || undefined;
		let imagePath = el.imagePath;
		const posterData =
			el.imageData ??
			(typeof el.posterImage === 'string' && el.posterImage.startsWith('data:')
				? el.posterImage
				: undefined);
		if (posterData) {
			const parsed = this.parseDataUrlToBytes(posterData);
			if (parsed) {
				imagePath ??= ctx.saveSession.nextMediaPath(parsed.extension);
				this.zip.file(imagePath, parsed.bytes);
			}
		} else if (!imagePath && el.posterImage?.startsWith('ppt/')) {
			imagePath = el.posterImage;
		}
		if (imagePath) {
			relationshipId ??= ctx.slideRelationshipRegistry.nextRelationshipId();
			ctx.slideRelationshipRegistry.upsertRelationship(
				relationshipId,
				ctx.slideImageRelationshipType,
				imagePath.replace(/^ppt\//u, '../'),
			);
			el.imagePath = imagePath;
		}
		return { relationshipId };
	}

	private buildModel3DShapeProperties(el: Model3DPptxElement): XmlObject {
		const result: XmlObject = {
			'a:xfrm': {},
			'a:prstGeom': { '@_prst': 'rect', 'a:avLst': {} },
		};
		this.applyModel3DTransform(result, el);
		return result;
	}

	private applyModel3DTransform(spPr: XmlObject, el: Model3DPptxElement): void {
		const transform = (spPr['a:xfrm'] ??= {}) as XmlObject;
		const emu = PptxHandlerRuntime.EMU_PER_PX;
		transform['a:off'] = {
			'@_x': String(Math.round(el.x * emu)),
			'@_y': String(Math.round(el.y * emu)),
		};
		transform['a:ext'] = {
			'@_cx': String(Math.round(Math.max(el.width, 1) * emu)),
			'@_cy': String(Math.round(Math.max(el.height, 1) * emu)),
		};
		this.applyModel3DTransformFlags(transform, el);
	}

	private applyModel3DTransformFlags(transform: XmlObject, el: Model3DPptxElement): void {
		for (const [attribute, value] of [
			['@_rot', el.rotation],
			['@_skewX', el.skewX],
			['@_skewY', el.skewY],
		] as const) {
			if (value === undefined) {
				delete transform[attribute];
			} else {
				transform[attribute] = String(Math.round(value * 60000));
			}
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

	private buildModel3DFallbackPicture(
		el: Model3DPptxElement,
		posterRelationshipId: string | undefined,
	): XmlObject {
		return {
			'p:nvPicPr': {
				'p:cNvPr': { '@_id': el.shapeId ?? '2', '@_name': el.name || el.id },
				'p:cNvPicPr': { 'a:picLocks': { '@_noChangeAspect': '1' } },
				'p:nvPr': {},
			},
			'p:blipFill': {
				'a:blip': posterRelationshipId ? { '@_r:embed': posterRelationshipId } : {},
				'a:stretch': { 'a:fillRect': {} },
			},
			'p:spPr': this.buildModel3DShapeProperties(el),
		};
	}

	private updateModel3DFallback(
		shape: XmlObject,
		el: Model3DPptxElement,
		posterRelationshipId: string,
	): void {
		const block = this.alternateContentBlockByRawXml.get(shape);
		const fallback = block?.rawAc['mc:Fallback'] as XmlObject | undefined;
		const picture = fallback?.['p:pic'] as XmlObject | undefined;
		if (!picture) {
			return;
		}
		this.applyModel3DTransform((picture['p:spPr'] ??= {}) as XmlObject, el);
		const fill = (picture['p:blipFill'] ??= {}) as XmlObject;
		const blip = (fill['a:blip'] ??= {}) as XmlObject;
		blip['@_r:embed'] = posterRelationshipId;
	}
}
