import { hasShapeProperties, hasTextProperties } from '../../types';
import type {
	XmlObject,
	PptxElement,
	ChartPptxElement,
	GroupPptxElement,
	InkPptxElement,
	MediaPptxElement,
	Model3DPptxElement,
	OlePptxElement,
	PptxImageLikeElement,
	SmartArtPptxElement,
	TablePptxElement,
	ZoomPptxElement,
} from '../../types';
import { buildChartColorStyleXml } from '../../utils/chart-color-style-writer';
import { buildChartExSpaceXml, canGenerateChartEx } from '../../utils/chart-cx-generator';
import { buildChartSpaceXml } from '../../utils/chart-xml-generator';
import { BLIP_FILL_ORDER, SP_PR_ORDER, reorderObjectKeys } from '../../utils/xml-reorder';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveContentPartInk';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { CHART_CONTENT_TYPE, CHART_RELATIONSHIP_TYPE } from './PptxHandlerRuntimeSaveShapeXml';

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
	readonly zooms: XmlObject[];
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	private static readonly CHART_COLOR_CONTENT_TYPE =
		'application/vnd.ms-office.chartcolorstyle+xml';
	private static readonly CHART_COLOR_REL_TYPE =
		'http://schemas.microsoft.com/office/2011/relationships/chartColorStyle';
	private static readonly CHART_EX_CONTENT_TYPE = 'application/vnd.ms-office.chartex+xml';
	private static readonly CHART_EX_REL_TYPE =
		'http://schemas.microsoft.com/office/2014/relationships/chartEx';
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
	protected pendingExtendedChartPartPaths?: string[];
	protected pendingChartColorPartPaths?: string[];

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

	/** Pick the next free `ppt/extendedCharts/chartN.xml` path. */
	protected nextExtendedChartPartPath(): string {
		const paths = [...Object.keys(this.zip.files), ...(this.pendingExtendedChartPartPaths ?? [])];
		let n = 1;
		while (paths.includes(`ppt/extendedCharts/chart${n}.xml`)) {
			n += 1;
		}
		return `ppt/extendedCharts/chart${n}.xml`;
	}

	/**
	 * Generate a self-contained chart part for an SDK-created chart, register a
	 * slide relationship to it, and return the `p:graphicFrame` envelope. The
	 * content-type override is added later from {@link pendingChartPartPaths}.
	 */
	protected createChartElementXml(el: ChartPptxElement, ctx: SaveSlideContext): XmlObject {
		const extended = canGenerateChartEx(el.chartData!);
		const partPath = extended ? this.nextExtendedChartPartPath() : this.nextChartPartPath();
		const chartXml = extended
			? buildChartExSpaceXml(el.chartData!)
			: buildChartSpaceXml(el.chartData!);
		this.zip.file(partPath, this.builder.build(chartXml));
		if (extended) {
			(this.pendingExtendedChartPartPaths ??= []).push(partPath);
		} else {
			(this.pendingChartPartPaths ??= []).push(partPath);
		}
		if (el.chartData?.colorPalette?.length) {
			const fileName = partPath.slice(partPath.lastIndexOf('/') + 1);
			const index = /\d+/u.exec(fileName)?.[0] ?? '1';
			const directory = partPath.slice(0, partPath.lastIndexOf('/'));
			const colorPath = `${directory}/colors${index}.xml`;
			this.zip.file(
				colorPath,
				this.builder.build(
					buildChartColorStyleXml(el.chartData.colorPalette, el.chartData.colorMethod ?? 'cycle'),
				),
			);
			(this.pendingChartColorPartPaths ??= []).push(colorPath);
			this.zip.file(
				`${directory}/_rels/${fileName}.rels`,
				this.builder.build({
					Relationships: {
						'@_xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships',
						Relationship: {
							'@_Id': 'rId1',
							'@_Type': PptxHandlerRuntime.CHART_COLOR_REL_TYPE,
							'@_Target': `colors${index}.xml`,
						},
					},
				}),
			);
		}

		const relId = ctx.slideRelationshipRegistry.nextRelationshipId();
		ctx.slideRelationships.push({
			'@_Id': relId,
			'@_Type': extended ? PptxHandlerRuntime.CHART_EX_REL_TYPE : CHART_RELATIONSHIP_TYPE,
			'@_Target': `../${partPath.slice('ppt/'.length)}`,
		});
		return this.createChartGraphicFrameXml(el, relId, extended);
	}

	/**
	 * Add `[Content_Types].xml` Override entries for any chart parts generated
	 * for SDK-created charts this save. Called from the save pipeline after
	 * element writing; a no-op when no charts were generated.
	 */
	protected async ensureChartPartContentTypes(): Promise<void> {
		const paths = this.pendingChartPartPaths;
		const extendedPaths = this.pendingExtendedChartPartPaths;
		const colorPaths = this.pendingChartColorPartPaths;
		this.pendingChartPartPaths = undefined;
		this.pendingExtendedChartPartPaths = undefined;
		this.pendingChartColorPartPaths = undefined;
		if (
			(!paths || paths.length === 0) &&
			(!extendedPaths || extendedPaths.length === 0) &&
			(!colorPaths || colorPaths.length === 0)
		) {
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
		for (const [p, contentType] of [
			...(paths ?? []).map((path) => [path, CHART_CONTENT_TYPE] as const),
			...(extendedPaths ?? []).map(
				(path) => [path, PptxHandlerRuntime.CHART_EX_CONTENT_TYPE] as const,
			),
			...(colorPaths ?? []).map(
				(path) => [path, PptxHandlerRuntime.CHART_COLOR_CONTENT_TYPE] as const,
			),
		]) {
			const partName = `/${p}`;
			if (!have.has(partName)) {
				overrides.push({ '@_PartName': partName, '@_ContentType': contentType });
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
			shape = this.createOrUpdateContentPartInkXml(el, shape, ctx);
			if (shape) {
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
			// verbatim because re-encoding it would lose
			// pressure, tool metadata, and per-stroke style. Only SDK-created ink
			// elements (no rawXml) use the editable aink writer, which also carries
			// a custGeom fallback for consumers that do not support Office 2010 ink.
			if (!shape) {
				shape = this.createInkGraphicFrameXml(el as InkPptxElement);
			}
		}
		if (el.type === 'zoom') {
			shape = this.createOrUpdateZoomXml(el as ZoomPptxElement, shape, ctx);
			if (shape) {
				collectors.zooms.push(shape);
			} else {
				this.compatibilityService.reportWarning({
					code: 'SAVE_ELEMENT_SKIPPED',
					message: `Slide Zoom '${el.id}' has no valid target slide and was skipped.`,
					scope: 'save',
					slideId: ctx.slide.id,
					elementId: el.id,
				});
			}
			return;
		}
		if (el.type === 'model3d') {
			shape = this.createOrUpdateModel3DXml(el as Model3DPptxElement, shape, ctx);
			if (shape) {
				collectors.model3ds.push(shape);
			} else {
				this.compatibilityService.reportWarning({
					code: 'SAVE_ELEMENT_SKIPPED',
					message: `3D model '${el.id}' has no valid model payload and was skipped.`,
					scope: 'save',
					slideId: ctx.slide.id,
					elementId: el.id,
				});
			}
			return;
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
				shape = this.createOleElementWithPayload(oleEl, ctx);
				if (!shape) {
					const embedRid =
						this.resolveOleEmbedRelationshipId(ctx.slideRelationships, oleEl.oleTarget) ||
						ctx.slideRelationshipRegistry.nextRelationshipId();
					shape = this.createOleGraphicFrameXml(oleEl, embedRid);
				}
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
		} else if (el.type === 'media' && this.isPictureShape(shape)) {
			collectors.pics.push(shape);
		} else if (this.isGraphicFrameShape(shape)) {
			collectors.graphicFrames.push(shape);
		} else {
			collectors.shapes.push(shape);
		}
	}
}
