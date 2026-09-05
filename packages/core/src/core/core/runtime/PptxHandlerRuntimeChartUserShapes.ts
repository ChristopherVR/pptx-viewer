/**
 * Save-side sync for a chart's drawing-overlay part (`c:userShapes`).
 *
 * `chartData.userShapes` is populated at parse time by
 * `chart-user-shapes-parser.ts` and stays `undefined` unless the chart
 * actually has an overlay (see that module's `shapes.length > 0 ? shapes :
 * undefined` contract). This mixin's {@link syncChartUserShapesToXml} relies
 * on that: `undefined` always means "no edit signal, leave the original
 * drawing part exactly as authored"; only an explicit array (possibly `[]`,
 * which the SDK's `removeChartUserShape` produces when the last shape is
 * removed) is treated as an edit to reconcile against disk.
 *
 * Mixin chain position:
 *   `PptxHandlerRuntimeSaveTableStyles` -> **this** -> `PptxHandlerRuntimeSaveDataSerialization`
 *
 * This sits in the SAVE half of the mixin chain, below (more base than) the
 * PARSE-side `PptxHandlerRuntimeChartExternalData`, so its `readChartRels`
 * helper is not an ancestor method here and is intentionally re-implemented
 * as {@link readChartUserShapesRel} rather than reordering the parse chain
 * (out of this change's ownership).
 */

import { XmlObject } from '../../types';
import type { PptxChartData, PptxChartUserShape } from '../../types';
import { parseChartUserShapesDrawing } from '../../utils/chart-user-shapes-parser';
import { buildChartUserShapesDrawingXml } from '../../utils/chart-user-shapes-serializer';
import { ensureContentTypeOverride, relativePartTarget } from './chart-part-registration';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveTableStyles';

/** Relationship type URI for a chart's user-shapes drawing part. */
const CHART_USER_SHAPES_REL_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartUserShapes';

/** Content type for the `c:userShapes` drawing part, per ECMA-376 part 1 Annex A. */
const CHART_USER_SHAPES_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Reconcile a chart's `c:userShapes` reference and drawing part against
	 * the current `chartData.userShapes` typed model, writing a new or
	 * updated drawing part only when the model actually diverges from what
	 * is currently on disk (see module doc for the dirty-detection contract).
	 */
	protected async syncChartUserShapesToXml(
		chartSpace: XmlObject,
		chartData: PptxChartData,
		chartPartPath: string,
	): Promise<void> {
		if (chartData.userShapes === undefined) {
			return;
		}
		const desired = chartData.userShapes;

		const existingRel = await this.readChartUserShapesRel(chartPartPath);
		let onDisk: PptxChartUserShape[] = [];
		let drawingPath: string | undefined;
		if (existingRel?.target) {
			drawingPath = this.resolveImagePath(chartPartPath, existingRel.target);
			try {
				const xml = await this.zip.file(drawingPath)?.async('string');
				if (xml) {
					const root = this.parser.parse(xml) as XmlObject;
					onDisk =
						parseChartUserShapesDrawing(root, this.xmlLookupService, {
							parseColor: (node, placeholder) => this.parseColor(node, placeholder),
						}) ?? [];
				}
			} catch {
				onDisk = [];
			}
		}

		if (JSON.stringify(onDisk) === JSON.stringify(desired)) {
			return;
		}

		if (desired.length === 0) {
			this.removeChartUserShapesNode(chartSpace);
			return;
		}

		const drawingXml = this.builder.build(buildChartUserShapesDrawingXml(desired));
		if (drawingPath) {
			this.zip.file(drawingPath, drawingXml);
			return;
		}

		// The chart never had a `c:userShapes` reference: fabricate a fresh
		// drawing part, relationship, and content-type override.
		const newPath = this.nextFreeChartDrawingPartPath();
		this.zip.file(newPath, drawingXml);
		await ensureContentTypeOverride(
			{
				zip: this.zip,
				parser: this.parser,
				builder: this.builder,
				getLocalName: (key) => this.compatibilityService.getXmlLocalName(key),
			},
			newPath,
			CHART_USER_SHAPES_CONTENT_TYPE,
		);
		const relId = await this.addChartUserShapesRelationship(
			chartPartPath,
			relativePartTarget(chartPartPath, newPath),
		);
		this.upsertChartUserShapesNode(chartSpace, relId);
	}

	/**
	 * Find the chart part's `chartUserShapes` relationship, if any, by
	 * reading its `.rels` file directly. Duplicated (rather than reused) from
	 * the parse-side `PptxHandlerRuntimeChartExternalData.readChartRels`:
	 * that mixin sits above this one in the runtime's single mixin chain (the
	 * SAVE mixins are its base, not the reverse), so its protected method is
	 * not inherited here.
	 */
	private async readChartUserShapesRel(
		chartPartPath: string,
	): Promise<{ id: string; target: string } | undefined> {
		const slash = chartPartPath.lastIndexOf('/');
		const relsPath = `${chartPartPath.slice(0, slash + 1)}_rels/${chartPartPath.slice(slash + 1)}.rels`;
		try {
			const xml = await this.zip.file(relsPath)?.async('string');
			if (!xml) {
				return undefined;
			}
			const tree = this.parser.parse(xml) as XmlObject;
			const root = tree['Relationships'] as XmlObject | undefined;
			const rels = root?.['Relationship'];
			const list: XmlObject[] =
				rels === undefined ? [] : Array.isArray(rels) ? rels : [rels as XmlObject];
			const match = list.find(
				(rel) => String(rel['@_Type'] ?? '').trim() === CHART_USER_SHAPES_REL_TYPE,
			);
			if (!match) {
				return undefined;
			}
			return { id: String(match['@_Id'] ?? ''), target: String(match['@_Target'] ?? '') };
		} catch {
			return undefined;
		}
	}

	/** Pick the next free `ppt/drawings/drawingN.xml` path in the package. */
	private nextFreeChartDrawingPartPath(): string {
		let n = 1;
		while (this.zip.file(`ppt/drawings/drawing${n}.xml`)) {
			n += 1;
		}
		return `ppt/drawings/drawing${n}.xml`;
	}

	/** Remove the chart's `c:userShapes` element (all overlay shapes cleared). */
	private removeChartUserShapesNode(chartSpace: XmlObject): void {
		const key = Object.keys(chartSpace).find(
			(k) => this.compatibilityService.getXmlLocalName(k) === 'userShapes',
		);
		if (key) {
			delete chartSpace[key];
		}
	}

	/**
	 * Set (or insert) `c:userShapes/@_r:id` on the chart space. `CT_ChartSpace`
	 * sequences `userShapes` immediately before `extLst`, so a brand-new
	 * reference is inserted there (or appended) to stay in schema order.
	 */
	private upsertChartUserShapesNode(chartSpace: XmlObject, relId: string): void {
		const node: XmlObject = { '@_r:id': relId };
		const existingKey = Object.keys(chartSpace).find(
			(k) => this.compatibilityService.getXmlLocalName(k) === 'userShapes',
		);
		if (existingKey) {
			chartSpace[existingKey] = node;
			return;
		}
		const keys = Object.keys(chartSpace);
		const extIdx = keys.findIndex((k) => this.compatibilityService.getXmlLocalName(k) === 'extLst');
		const entries = keys.map((k) => [k, chartSpace[k]] as const);
		entries.splice(extIdx === -1 ? entries.length : extIdx, 0, ['c:userShapes', node] as const);
		for (const k of keys) {
			delete chartSpace[k];
		}
		for (const [k, v] of entries) {
			chartSpace[k] = v;
		}
	}

	/**
	 * Add a `chartUserShapes` relationship to the chart part's own `.rels`
	 * file (creating the file if the chart had no relationships at all),
	 * returning the freshly assigned `rIdN`.
	 */
	private async addChartUserShapesRelationship(
		chartPartPath: string,
		target: string,
	): Promise<string> {
		const slash = chartPartPath.lastIndexOf('/');
		const relsPath = `${chartPartPath.slice(0, slash + 1)}_rels/${chartPartPath.slice(slash + 1)}.rels`;
		const existingXml = await this.zip.file(relsPath)?.async('string');
		const tree: XmlObject = existingXml
			? (this.parser.parse(existingXml) as XmlObject)
			: {
					Relationships: {
						'@_xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships',
					},
				};
		const root = (tree['Relationships'] ?? {}) as XmlObject;
		const existing = root['Relationship'];
		const list: XmlObject[] =
			existing === undefined
				? []
				: Array.isArray(existing)
					? [...existing]
					: [existing as XmlObject];

		const usedIds = new Set(list.map((rel) => String(rel['@_Id'])));
		let n = 1;
		while (usedIds.has(`rId${n}`)) {
			n += 1;
		}
		const id = `rId${n}`;
		list.push({ '@_Id': id, '@_Type': CHART_USER_SHAPES_REL_TYPE, '@_Target': target });
		root['Relationship'] = list.length === 1 ? list[0] : list;
		tree['Relationships'] = root;
		this.zip.file(relsPath, this.builder.build(tree));
		return id;
	}
}
