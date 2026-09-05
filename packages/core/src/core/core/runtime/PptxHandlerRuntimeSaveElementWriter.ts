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
import { ensureXmlChild } from '../../utils/xml-access';
import { BLIP_FILL_ORDER, SP_PR_ORDER, reorderObjectKeys } from '../../utils/xml-reorder';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveContentPartInk';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { CHART_CONTENT_TYPE, CHART_RELATIONSHIP_TYPE } from './PptxHandlerRuntimeSaveShapeXml';
import { collapseOrderedXmlChildren, replaceXmlNodeContents } from './template-group-node';

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
	 *
	 * `p:nvPicPr` is the whole test, deliberately: it is the one member
	 * `CT_Picture` requires and no other shape-tree type has. It must NOT be
	 * widened to "carries a blip somewhere", because a `<p:sp>` with an
	 * `<a:blipFill>` in its `p:spPr` is a shape with a picture fill, not a
	 * picture, and emitting it as `<p:pic>` is the inverse corruption of the
	 * media case above.
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

	/**
	 * Whether this element is an inherited layout/master shape that the slide is
	 * only painting, and so has to be written back to the template part instead
	 * of into the slide's own `p:spTree`.
	 *
	 * The id prefix alone is NOT enough. A template group's children derive
	 * their ids from the group's own base id, which already begins `layout-` /
	 * `master-`, so `isTemplateElementId` is true for every descendant as well.
	 * Routing a descendant through the template writer would lift it out of its
	 * `<p:grpSp>` and append it to the layout's shape tree as a top-level
	 * sibling. Only an element the caller listed on the slide is a candidate;
	 * a group child is reached through its parent instead.
	 */
	protected isOwnTemplateElement(el: PptxElement, ctx: SaveSlideContext): boolean {
		return this.isTemplateElementId(el.id) && ctx.slide.elements.includes(el);
	}

	/**
	 * Write an edited layout/master group back into the part it came from.
	 *
	 * `buildGroupShapeXml` returns a NEW node, while every other element type
	 * reaches the template writer as its own `rawXml` patched in place. The
	 * rebuilt group is therefore folded back into that same node before it is
	 * attached, so `ensureTemplateShapeAttached` recognises it as the shape
	 * already in the tree rather than appending a duplicate `<p:grpSp>`. A
	 * group with no `rawXml` (one the user created inside the master view) has
	 * nothing to fold into and is appended.
	 */
	private attachTemplateGroupShape(
		el: GroupPptxElement,
		grpXml: XmlObject,
		ctx: SaveSlideContext,
	): void {
		const templateSpTree = this.getTemplateSpTree(ctx.slide.id, el.id);
		if (!templateSpTree) {
			return;
		}
		collapseOrderedXmlChildren(grpXml);
		const raw = el.rawXml as XmlObject | undefined;
		const attached = raw ? replaceXmlNodeContents(raw, grpXml) : grpXml;
		el.rawXml = this.ensureTemplateShapeAttached(templateSpTree, 'group', attached);
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
	 * Write the element's user-visible name back to `p:cNvPr/@name`.
	 *
	 * Without this a rename is viewer-local: renaming a shape in the Selection
	 * Pane, saving and reopening brings the old name back, here and in
	 * PowerPoint. `@_name` used to be written only where brand-new shape XML is
	 * fabricated, never when patching an existing `p:cNvPr`.
	 *
	 * `undefined` means "the model has no opinion", NOT "clear it": several
	 * element kinds (charts, SmartArt and other graphic frames) parse without
	 * populating `name` while their markup carries a real one, so blanking on
	 * `undefined` would wipe the name of every such frame on a plain
	 * round-trip. An explicit empty string is honoured, and is written as
	 * `name=""` rather than deleted because `@name` is REQUIRED on
	 * `CT_NonVisualDrawingProps` (ECMA-376 S20.1.2.2.8) - unlike `@hidden`,
	 * which is optional and therefore is deleted when false.
	 */
	protected applyNameToCnvPr(shape: XmlObject, el: PptxElement): void {
		if (el.name === undefined) {
			return;
		}
		for (const nvKey of PptxHandlerRuntime.NV_CONTAINERS) {
			const nv = shape[nvKey] as XmlObject | undefined;
			const cNvPr = nv?.['p:cNvPr'] as XmlObject | undefined;
			if (cNvPr) {
				cNvPr['@_name'] = el.name;
				return;
			}
		}
	}

	/**
	 * Write the Selection Pane's hide toggle back to `p:cNvPr/@hidden`.
	 *
	 * Without this the flag is viewer-local: hiding a shape, saving and
	 * reopening brings it back, both here and in PowerPoint. The attribute is
	 * DELETED rather than written as `"0"` when the element is visible, so a
	 * shape that was never hidden round-trips byte-for-byte and one that is
	 * un-hidden does not leave a redundant attribute behind.
	 */
	protected applyHiddenToCnvPr(shape: XmlObject, el: PptxElement): void {
		for (const nvKey of PptxHandlerRuntime.NV_CONTAINERS) {
			const nv = shape[nvKey] as XmlObject | undefined;
			const cNvPr = nv?.['p:cNvPr'] as XmlObject | undefined;
			if (cNvPr) {
				if (el.hidden) {
					cNvPr['@_hidden'] = '1';
				} else {
					delete cNvPr['@_hidden'];
				}
				return;
			}
		}
	}

	/**
	 * Write a graphic-frame element's (table/chart/smartArt/ole/media)
	 * accessibility text back to `p:nvGraphicFramePr/p:cNvPr/@descr` / `@title`.
	 *
	 * Mirrors `applyImageProperties`'s alt-text handling for pictures
	 * (`p:nvPicPr/p:cNvPr/@descr`), which never covered a graphic frame:
	 * `PptxGraphicFrameParser.ts` now parses `altText`/`title` on these five
	 * element types, so an edit to either field needs a write-side mirror or
	 * it is silently dropped on save. `undefined` means "the model has no
	 * opinion" (left untouched, same as `applyNameToCnvPr`'s `name`); an
	 * explicit empty string clears the attribute.
	 */
	protected applyGraphicFrameAltTextToCnvPr(shape: XmlObject, el: PptxElement): void {
		if (
			el.type !== 'table' &&
			el.type !== 'chart' &&
			el.type !== 'smartArt' &&
			el.type !== 'ole' &&
			el.type !== 'media'
		) {
			return;
		}
		const cNvPr = (shape['p:nvGraphicFramePr'] as XmlObject | undefined)?.['p:cNvPr'] as
			| XmlObject
			| undefined;
		if (!cNvPr) {
			return;
		}
		if (el.altText !== undefined) {
			const trimmed = el.altText.trim();
			if (trimmed.length > 0) {
				cNvPr['@_descr'] = trimmed;
			} else {
				delete cNvPr['@_descr'];
			}
		}
		if (el.title !== undefined) {
			const trimmed = el.title.trim();
			if (trimmed.length > 0) {
				cNvPr['@_title'] = trimmed;
			} else {
				delete cNvPr['@_title'];
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
			const grpXml = this.buildGroupShapeXml(el as GroupPptxElement, ctx);
			if (!grpXml) {
				return;
			}
			// Locks are the one part of a group's non-visual properties the model
			// owns; everything else on `p:nvGrpSpPr` is carried over verbatim by
			// `buildGroupNonVisualXml`.
			this.serializeShapeLocks(grpXml, el);
			// A `p:grpSp` inherited from this slide's layout or master belongs to
			// that part, which the save pipeline flushes verbatim from
			// `layoutXmlMap` / `masterXmlMap`. Pushing it into `collectors.groups`
			// copied it into EVERY slide's own `p:spTree`: on
			// `e2e/fixtures/absolute-path-rels.pptx` (the only deck in the corpus
			// with a layout-level group) the deck grew from 82 to 106 shapes on a
			// no-edit round-trip. It goes back to the part it came from instead,
			// exactly as every other element type does further down.
			if (this.isOwnTemplateElement(el, ctx)) {
				this.attachTemplateGroupShape(el as GroupPptxElement, grpXml, ctx);
				return;
			}
			collectors.groups.push(grpXml);
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
			// verbatim because re-encoding it would lose pressure, tool metadata,
			// and per-stroke style. New Draw-tab ink has no rawXml and is authored
			// as a standards-shaped `p:contentPart` plus a related InkML part, the
			// same representation PowerPoint's own pen writes and the one
			// `PptxHandlerRuntimeSaveContentPartInk` already parses back on load,
			// so authored strokes survive as editable ink instead of downgrading
			// to a static freeform shape.
			if (!shape) {
				const contentPart = this.createContentPartInkFromInkElement(el as InkPptxElement, ctx);
				if (contentPart) {
					collectors.contentParts.push(contentPart);
				} else {
					this.compatibilityService.reportWarning({
						code: 'SAVE_ELEMENT_SKIPPED',
						message: `Ink element '${el.id}' contains no valid stroke and was skipped during save.`,
						scope: 'save',
						slideId: ctx.slide.id,
						elementId: el.id,
					});
				}
				return;
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
		//
		// `ensureXmlChild`, not a truthiness test on `shape['p:spPr']`: an
		// unstyled shape is authored `<p:spPr/>`, which fast-xml-parser gives us
		// as the empty STRING. A falsy gate here skipped the whole block, so
		// setting a fill, an outline (colour / width / dash / arrows / join /
		// cap), a shadow, glow, reflection, 3D or a `<p:style>` ref on such a
		// shape silently never reached the saved file. Reproduced on
		// corpus/master-layout-inheritance-fills.pptx, which loads NINE elements
		// whose `rawXml['p:spPr']` is `''`; a solid fill set on one of them left
		// no trace in the saved part. Bare `<p:spPr/>` occurs 623 times across
		// all 45 committed decks, so this was the common case, not the corner.
		if (hasShapeProperties(el) && el.shapeStyle) {
			const spPr = ensureXmlChild(shape, 'p:spPr');
			if (spPr) {
				this.applyFillAndStroke(spPr, el.shapeStyle, ctx.inheritedGroupFill);
				this.applyEffectsAndThreeD(spPr, el.shapeStyle);
				this.finalizeSpPrSchemaOrder(shape);
				// Re-emit `<p:style>` (lnRef/fillRef/effectRef/fontRef) — Phase 2 Stream B / C-H2.
				this.applyShapeStyleRefs(shape, el.shapeStyle);
			}
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

		// Selection Pane visibility and name. Applied before the template branch
		// below so a hidden or renamed inherited layout/master shape persists too.
		this.applyHiddenToCnvPr(shape, el);
		this.applyNameToCnvPr(shape, el);
		this.applyGraphicFrameAltTextToCnvPr(shape, el);

		// Template elements
		if (this.isOwnTemplateElement(el, ctx)) {
			const templateSpTree = this.getTemplateSpTree(ctx.slide.id, el.id);
			if (templateSpTree) {
				el.rawXml = this.ensureTemplateShapeAttached(templateSpTree, el.type, shape);
			}
			return;
		}

		// Keep the serialized `p:cNvPr/@id` in sync with the element's native
		// shape id so animation `p:spTgt/@spid` references bind correctly.
		this.applyShapeIdToCnvPr(shape, el);

		// Sort into collector.
		//
		// Bucketing is driven by the MARKUP of the node about to be emitted, not
		// by the model's `type` discriminant. Each collector is assigned to one
		// fixed `p:spTree` tag by the slide writer (`pics` -> `<p:pic>`), and
		// `rawXml` passthrough means the node already carries the body it was
		// parsed from, so a mismatch re-labels a node without rewriting its
		// contents: the tag says `p:pic` while the children are still a shape's.
		//
		// `type: 'picture'` does NOT imply `<p:pic>`. `parseShapeWithImageFill`
		// reports a `<p:sp>` whose `p:spPr` carries an `<a:blipFill>` (a shape
		// with a picture FILL, e.g. a photo-filled ellipse) as a `picture`
		// element, because that is what it renders as. Bucketing on the type
		// alone emitted that shape body under `<p:pic>`, yielding a `CT_Picture`
		// (S19.3.1.37, sequence `nvPicPr, blipFill, spPr`) that had `p:nvSpPr`
		// instead of `p:nvPicPr`, no `p:blipFill` at all, and stray `p:style` /
		// `p:txBody` members that are not part of the type. PowerPoint rejected
		// the whole package. Picture-ness that comes from a fill does not change
		// the tag; a genuine `<p:pic>` is identified by its own `p:nvPicPr`,
		// which `createPictureXml` also emits for SDK-created images.
		if (el.type === 'connector') {
			collectors.connectors.push(shape);
		} else if (this.isPictureShape(shape)) {
			collectors.pics.push(shape);
		} else if (this.isGraphicFrameShape(shape)) {
			collectors.graphicFrames.push(shape);
		} else {
			collectors.shapes.push(shape);
		}
	}
}
