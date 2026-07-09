import { hasShapeProperties, hasTextProperties } from '../../types';
import type {
	XmlObject,
	PptxElement,
	ChartPptxElement,
	GroupPptxElement,
	InkPptxElement,
	MediaPptxElement,
	OlePptxElement,
	PptxImageLikeElement,
	SmartArtPptxElement,
	TablePptxElement,
} from '../../types';
import { buildChartSpaceXml } from '../../utils/chart-xml-generator';
import { BLIP_FILL_ORDER, SP_PR_ORDER, reorderObjectKeys } from '../../utils/xml-reorder';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { CHART_CONTENT_TYPE, CHART_RELATIONSHIP_TYPE } from './PptxHandlerRuntimeSaveShapeXml';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSmartArtFabrication';

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
	/**
	 * Whether a shape XML represents a `<p:pic>` (picture-shaped) node.
	 *
	 * Real PowerPoint (verified via COM-authored fixtures) represents video
	 * *and* audio media as `<p:pic>` (poster-frame blip + `p:nvPr/a:videoFile`
	 * or `a:audioFile` + a `p14:media` extension) rather than the older
	 * `<p:graphicFrame>` form. A `media`-typed element's `rawXml` is
	 * therefore frequently `p:pic`-shaped, not a graphic frame; without this
	 * check it falls into the generic `shapes` bucket, which the slide
	 * writer serializes under `<p:sp>` -- corrupting the picture markup
	 * (`p:nvPicPr`/`p:blipFill`) into an invalid shape and permanently
	 * losing the media relationship on save.
	 */
	protected isPictureShape(shape: XmlObject): boolean {
		return Boolean(shape['p:nvPicPr']);
	}

	/** Whether a shape XML represents a graphic frame. */
	protected isGraphicFrameShape(shape: XmlObject): boolean {
		return Boolean(shape['p:nvGraphicFramePr'] || (shape['a:graphic'] && shape['p:xfrm']));
	}

	/** Part paths of SDK-created charts written this save (need content-type overrides). */
	protected pendingChartPartPaths?: string[];

	/** Pick the next free `ppt/charts/chartN.xml` path (reads the zip + pending writes). */
	protected nextChartPartPath(): string {
		const used = new Set<number>();
		const re = /^ppt\/charts\/chart(?<n>\d+)\.xml$/u;
		const collect = (name: string): void => {
			const m = re.exec(name);
			if (m?.groups?.n) {
				used.add(Number.parseInt(m.groups.n, 10));
			}
		};
		for (const name of Object.keys(this.zip.files)) {
			collect(name);
		}
		for (const p of this.pendingChartPartPaths ?? []) {
			collect(p);
		}
		let n = 1;
		while (used.has(n)) {
			n += 1;
		}
		return `ppt/charts/chart${n}.xml`;
	}

	/**
	 * Generate a self-contained chart part for an SDK-created chart, register a
	 * slide relationship to it, and return the `p:graphicFrame` envelope. The
	 * content-type override is added later from {@link pendingChartPartPaths}.
	 */
	protected createChartElementXml(el: ChartPptxElement, ctx: SaveSlideContext): XmlObject {
		const partPath = this.nextChartPartPath();
		this.zip.file(partPath, this.builder.build(buildChartSpaceXml(el.chartData!)));
		(this.pendingChartPartPaths ??= []).push(partPath);

		const relId = ctx.slideRelationshipRegistry.nextRelationshipId();
		ctx.slideRelationships.push({
			'@_Id': relId,
			'@_Type': CHART_RELATIONSHIP_TYPE,
			'@_Target': `../charts/${partPath.slice(partPath.lastIndexOf('/') + 1)}`,
		});
		return this.createChartGraphicFrameXml(el, relId);
	}

	/**
	 * Add `[Content_Types].xml` Override entries for any chart parts generated
	 * for SDK-created charts this save. Called from the save pipeline after
	 * element writing; a no-op when no charts were generated.
	 */
	protected async ensureChartPartContentTypes(): Promise<void> {
		const paths = this.pendingChartPartPaths;
		this.pendingChartPartPaths = undefined;
		if (!paths || paths.length === 0) {
			return;
		}
		const ctXml = await this.zip.file('[Content_Types].xml')?.async('string');
		if (!ctXml) {
			return;
		}
		const ctData = this.parser.parse(ctXml) as XmlObject;
		const typesRoot = (ctData['Types'] || {}) as XmlObject;
		const overrides = Array.isArray(typesRoot['Override'])
			? (typesRoot['Override'] as XmlObject[])
			: typesRoot['Override']
				? [typesRoot['Override'] as XmlObject]
				: [];
		const have = new Set(overrides.map((o) => String(o?.['@_PartName'] || '')));
		for (const p of paths) {
			const partName = `/${p}`;
			if (!have.has(partName)) {
				overrides.push({ '@_PartName': partName, '@_ContentType': CHART_CONTENT_TYPE });
				have.add(partName);
			}
		}
		typesRoot['Override'] = overrides;
		ctData['Types'] = typesRoot;
		this.zip.file('[Content_Types].xml', this.builder.build(ctData));
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

	/** Non-visual property containers that hold a `p:cNvPr`. */
	private static readonly NV_CONTAINERS = [
		'p:nvSpPr',
		'p:nvPicPr',
		'p:nvCxnSpPr',
		'p:nvGraphicFramePr',
		'p:nvGrpSpPr',
	] as const;

	/**
	 * Write an element's native shape id (`element.shapeId`) into the serialized
	 * shape's `p:cNvPr/@id`. Animation targets (`p:spTgt/@spid`) reference this
	 * id, so the two must agree for PowerPoint to bind an animation to its shape.
	 * A no-op when the element carries no `shapeId` (nothing to reconcile) or the
	 * shape XML has no cNvPr container.
	 */
	protected applyShapeIdToCnvPr(shape: XmlObject, el: PptxElement): void {
		if (el.shapeId === undefined) {
			return;
		}
		for (const nvKey of PptxHandlerRuntime.NV_CONTAINERS) {
			const nv = shape[nvKey] as XmlObject | undefined;
			const cNvPr = nv?.['p:cNvPr'] as XmlObject | undefined;
			if (cNvPr) {
				cNvPr['@_id'] = el.shapeId;
				return;
			}
		}
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
		if (!shape && el.type === 'chart' && (el as ChartPptxElement).chartData) {
			// SDK-created charts (via `SlideBuilder.addChart`) have no rawXml and
			// no chart part. Generate a self-contained chart.xml, register a slide
			// relationship + content-type override, and fabricate the graphic
			// frame; without this the chart falls through to SAVE_ELEMENT_SKIPPED
			// and is dropped from the saved slide.
			shape = this.createChartElementXml(el as ChartPptxElement, ctx);
		}
		if (!shape && el.type === 'smartArt' && (el as SmartArtPptxElement).smartArtData) {
			// SDK-created SmartArt (inserted via the viewer) has no rawXml and no
			// diagram parts. Fabricate the data/layout/quickStyle/colors part
			// family, register the slide relationships + content-type overrides,
			// and build the graphic frame; without this the diagram falls through
			// to SAVE_ELEMENT_SKIPPED and vanishes from the saved slide.
			shape = this.createSmartArtElementXml(el as SmartArtPptxElement, ctx);
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

		// Keep the serialized `p:cNvPr/@id` in sync with the element's native
		// shape id so animation `p:spTgt/@spid` references bind correctly.
		this.applyShapeIdToCnvPr(shape, el);

		// Sort into collector
		if (el.type === 'picture' || el.type === 'image') {
			collectors.pics.push(shape);
		} else if (el.type === 'connector') {
			collectors.connectors.push(shape);
		} else if (el.type === 'model3d') {
			collectors.model3ds.push(shape);
		} else if (el.type === 'media' && this.isPictureShape(shape)) {
			collectors.pics.push(shape);
		} else if (this.isGraphicFrameShape(shape)) {
			collectors.graphicFrames.push(shape);
		} else {
			collectors.shapes.push(shape);
		}
	}
}
