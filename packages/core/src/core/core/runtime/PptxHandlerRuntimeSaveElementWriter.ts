import { hasShapeProperties, hasTextProperties } from '../../types';
import type {
	XmlObject,
	PptxElement,
	GroupPptxElement,
	InkPptxElement,
	MediaPptxElement,
	OlePptxElement,
	PptxImageLikeElement,
	TablePptxElement,
} from '../../types';
import { BLIP_FILL_ORDER, SP_PR_ORDER, reorderObjectKeys } from '../../utils/xml-reorder';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveElementEmbedding';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';

export type { SaveSlideContext };

/** Collector arrays for sorting processed elements into shape tree lists. */
export interface SlideShapeCollectors {
	readonly shapes: XmlObject[];
	readonly pics: XmlObject[];
	readonly connectors: XmlObject[];
	readonly graphicFrames: XmlObject[];
	readonly groups: XmlObject[];
	readonly model3ds: XmlObject[];
	readonly contentParts: XmlObject[];
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Whether a shape XML represents a graphic frame. */
	protected isGraphicFrameShape(shape: XmlObject): boolean {
		return Boolean(shape['p:nvGraphicFramePr'] || (shape['a:graphic'] && shape['p:xfrm']));
	}

	/**
	 * Reorder children of `p:spPr` to match CT_ShapeProperties (§20.1.2.2.35).
	 * Also reorders any nested `a:blipFill` per CT_BlipFillProperties.
	 * fast-xml-parser preserves insertion order; PowerPoint validates against
	 * the schema's required order, so save-side mutations must be re-sorted.
	 */
	protected finalizeSpPrSchemaOrder(shape: XmlObject): void {
		const spPr = shape['p:spPr'] as XmlObject | undefined;
		if (!spPr) {
			return;
		}
		const blipFill = spPr['a:blipFill'] as XmlObject | undefined;
		if (blipFill) {
			this.reorderInPlace(blipFill, BLIP_FILL_ORDER);
		}
		this.reorderInPlace(spPr, SP_PR_ORDER);
	}

	/**
	 * Reorder children of the picture-level `p:blipFill` (CT_BlipFillProperties).
	 * Picture elements carry their blip data on the `p:pic` root, not under spPr.
	 */
	protected finalizePictureBlipFillOrder(shape: XmlObject): void {
		const pBlipFill = shape['p:blipFill'] as XmlObject | undefined;
		if (pBlipFill) {
			this.reorderInPlace(pBlipFill, BLIP_FILL_ORDER);
		}
	}

	private reorderInPlace(target: XmlObject, schemaOrder: readonly string[]): void {
		const reordered = reorderObjectKeys(target, schemaOrder);
		for (const key of Object.keys(target)) {
			delete target[key];
		}
		for (const key of Object.keys(reordered)) {
			target[key] = reordered[key];
		}
	}

	/** Whether an element ID indicates a template (layout/master) element. */
	protected isTemplateElementId(elementId: string): boolean {
		return elementId.startsWith('layout-') || elementId.startsWith('master-');
	}

	/**
	 * Process a single slide element during save. Handles embedding,
	 * transforms, geometry, styles, text, and sorts into collectors.
	 */
	protected processSlideElement(
		el: PptxElement,
		collectors: SlideShapeCollectors,
		ctx: SaveSlideContext,
	): void {
		let shape = el.rawXml as XmlObject | undefined;

		// Image embedding
		if ((el.type === 'picture' || el.type === 'image') && typeof el.imageData === 'string') {
			shape = this.processImageEmbedding(el as PptxImageLikeElement, shape, ctx) ?? shape;
		}

		// Media embedding
		if (el.type === 'media') {
			shape = this.processMediaEmbedding(el as MediaPptxElement, shape, ctx) ?? shape;
		}

		// Group elements
		if (el.type === 'group') {
			const grpXml = this.buildGroupShapeXml(el as GroupPptxElement);
			if (grpXml) {
				collectors.groups.push(grpXml);
			}
			return;
		}

		// p:contentPart (CT_Rel-bearing ink reference, §19.3.1.14).
		// CT_GroupShape places `<p:contentPart>` as a direct child of
		// `<p:spTree>` — never inside `<p:sp>`. Without this case the
		// element would fall through to the bottom-of-function bucket
		// detection: `isGraphicFrameShape` returns false (no
		// `p:nvGraphicFramePr` / `a:graphic`) and the contentPart node
		// gets pushed into `collectors.shapes`, which the slide writer
		// later assigns to `spTree['p:sp']`. PowerPoint validates
		// p:contentPart against CT_Rel (only @_r:id + xfrm/extLst) — emitting
		// it as a child of `<p:sp>` produces schema-invalid output and
		// triggers the file-repair dialog. We pass the parsed rawXml
		// through verbatim into the dedicated `contentParts` slot, which
		// `PptxHandlerRuntimeSaveSlideWriter` lifts onto `spTree['p:contentPart']`.
		if (el.type === 'contentPart') {
			if (shape) {
				this.elementTransformUpdater.applyTransform(shape, el, PptxHandlerRuntime.EMU_PER_PX);
				collectors.contentParts.push(shape);
			} else {
				this.compatibilityService.reportWarning({
					code: 'SAVE_ELEMENT_SKIPPED',
					message: `Content part '${el.id}' has no rawXml and was skipped during save.`,
					scope: 'save',
					slideId: ctx.slide.id,
					elementId: el.id,
				});
			}
			return;
		}

		// Create new XML if missing
		if (!shape && (el.type === 'text' || el.type === 'shape')) {
			shape = this.createElementXml(el);
		}
		if (!shape && el.type === 'connector') {
			shape = this.createConnectorXml(el);
		}
		if (el.type === 'ink') {
			// Ink loaded from real files always carries the original
			// `<aink:ink>`-bearing graphicFrame on `rawXml`. We preserve it
			// verbatim — re-encoding to `a:custGeom` (the legacy fallback) loses
			// pressure, tool metadata, and per-stroke style. Only SDK-created ink
			// elements (no rawXml) fall through to the custGeom builder; that
			// path is a deliberate, lossy approximation kept for backward
			// compatibility (the OOXML aink writer is out of scope here).
			if (!shape) {
				shape = this.createInkShapeXml(el as InkPptxElement);
				this.compatibilityService.reportWarning({
					code: 'SAVE_INK_ENCODED_AS_CUSTGEOM',
					message:
						'SDK-created ink element serialized as custGeom shape; pressure/tool metadata not represented in OOXML aink format.',
					scope: 'save',
					slideId: ctx.slide.id,
					elementId: el.id,
				});
			}
		}
		if (!shape && el.type === 'table') {
			// SDK-created tables (via `SlideBuilder.addTable`) have no rawXml.
			// Fabricate a graphic-frame skeleton so the downstream
			// serializeTableDataToXml path can populate cells; without this,
			// the element falls through to SAVE_ELEMENT_SKIPPED and the
			// table is silently dropped from the saved slide.
			shape = this.createTableGraphicFrameXml(el as TablePptxElement);
		}
		if (el.type === 'ole') {
			// OLE round-trip strategy:
			// 1. If `rawXml` exists (loaded from a real file), prefer it and
			//    refresh only typed-field attributes (`progId` / `name` /
			//    `classid`); the binary part and preview blip already live in
			//    the package and pass through with the rest of the rels.
			// 2. If `rawXml` is missing (SDK-created, or model edited beyond
			//    typed fields), fabricate a schema-valid `p:graphicFrame`
			//    envelope referencing an existing OLE relationship on the
			//    slide. Brand-new SDK OLE creation also requires the consumer
			//    to drop the binary part into the package out-of-band.
			const oleEl = el as OlePptxElement;
			if (shape) {
				this.applyOleTypedFieldUpdates(shape, oleEl);
			} else {
				const embedRid =
					this.resolveOleEmbedRelationshipId(ctx.slideRelationships, oleEl.oleTarget) ||
					ctx.slideRelationshipRegistry.nextRelationshipId();
				shape = this.createOleGraphicFrameXml(oleEl, embedRid);
			}
		}

		if (!shape) {
			this.compatibilityService.reportWarning({
				code: 'SAVE_ELEMENT_SKIPPED',
				message: `Element '${el.id}' could not be serialized and was skipped during save.`,
				scope: 'save',
				slideId: ctx.slide.id,
				elementId: el.id,
			});
			return;
		}

		// Transform
		this.elementTransformUpdater.applyTransform(shape, el, PptxHandlerRuntime.EMU_PER_PX);

		// Image crop / effects / alt text
		this.applyImageProperties(shape, el);
		this.finalizePictureBlipFillOrder(shape);

		// Geometry
		this.applyGeometryUpdate(shape, el);

		// Shape styles (fill, stroke, effects, 3D)
		if (hasShapeProperties(el) && el.shapeStyle && shape['p:spPr']) {
			const spPr = shape['p:spPr'] as XmlObject;
			this.applyFillAndStroke(spPr, el.shapeStyle);
			this.applyEffectsAndThreeD(spPr, el.shapeStyle);
			this.finalizeSpPrSchemaOrder(shape);
			// Re-emit `<p:style>` (lnRef/fillRef/effectRef/fontRef) — Phase 2 Stream B / C-H2.
			this.applyShapeStyleRefs(shape, el.shapeStyle);
		}

		// Text body
		if (hasTextProperties(el)) {
			this.applyTextBodyContent(
				shape,
				el,
				ctx.resolveHyperlinkRelationshipId,
				ctx.getSlideRelationshipMap,
			);
		}

		// Table / Chart / SmartArt
		this.applyDataSerialization(shape, el, ctx.slide.id);

		// Actions and locks
		this.serializeElementActions(shape, el, ctx.resolveHyperlinkRelationshipId);
		this.serializeShapeLocks(shape, el);

		// Template elements
		if (this.isTemplateElementId(el.id)) {
			const templateSpTree = this.getTemplateSpTree(ctx.slide.id, el.id);
			if (templateSpTree) {
				el.rawXml = this.ensureTemplateShapeAttached(templateSpTree, el.type, shape);
			}
			return;
		}

		// Sort into collector
		if (el.type === 'picture' || el.type === 'image') {
			collectors.pics.push(shape);
		} else if (el.type === 'connector') {
			collectors.connectors.push(shape);
		} else if (el.type === 'model3d') {
			collectors.model3ds.push(shape);
		} else if (this.isGraphicFrameShape(shape)) {
			collectors.graphicFrames.push(shape);
		} else {
			collectors.shapes.push(shape);
		}
	}
}
