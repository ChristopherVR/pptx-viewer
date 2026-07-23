import { parseStructuredCustomGeometry } from '../../geometry/custom-geometry-parser';
import {
	parseGuideDefinitions,
	parseAdjustmentValues,
	evaluateGuides,
	evaluateGeometryPaths,
	resolveCoordinate,
	createBuiltinVariables,
} from '../../geometry/guide-formula';
import { XmlObject, ShapeStyle } from '../../types';
import type {
	AdjustHandlePolar,
	AdjustHandleXY,
	ConnectionSite,
	CustomGeometryPath,
	CustomGeometryRawData,
	CustomGeometryTextRect,
	PptxImageLikeElement,
	GeometryAdjustmentHandle,
} from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimePlaceholderLookup';
import { evaluatePresetAdjustmentFormula } from './preset-avlst-fmla';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected parseGeometryAdjustments(
		prstGeom: XmlObject | undefined,
	): Record<string, number> | undefined {
		if (!prstGeom) {
			return undefined;
		}
		const gdNodes = this.ensureArray(
			(prstGeom?.['a:avLst'] as XmlObject | undefined)?.['a:gd'],
		) as XmlObject[];
		if (gdNodes.length === 0) {
			return undefined;
		}

		const adjustments: Record<string, number> = {};
		// Resolved adjustments so far, so a later formula can reference an earlier
		// adjustment by name (passed to the non-literal formula evaluator).
		const priorAdjustments = new Map<string, number>();
		for (const gd of gdNodes) {
			const name = String(gd?.['@_name'] || '').trim();
			if (!name) {
				continue;
			}
			let value: number | undefined;

			if (gd?.['@_val'] !== undefined) {
				const parsed = Number.parseInt(String(gd['@_val']), 10);
				if (Number.isFinite(parsed)) {
					value = parsed;
				}
			}
			if (value === undefined && gd?.['@_fmla']) {
				const formula = String(gd['@_fmla']).trim();
				// Fast path: a literal `val N` adjustment (the overwhelmingly common
				// preset form). This must never regress.
				const match = formula.match(/^val\s+(-?\d+)$/i);
				if (match) {
					const parsed = Number.parseInt(match[1], 10);
					if (Number.isFinite(parsed)) {
						value = parsed;
					}
				} else {
					// Non-literal formula: evaluate geometry-independent forms via the
					// shared guide-formula engine. Geometry-dependent forms are deferred
					// (they resolve during render-time guide evaluation instead).
					value = evaluatePresetAdjustmentFormula(formula, name, priorAdjustments);
				}
			}

			if (value !== undefined) {
				adjustments[name] = value;
				priorAdjustments.set(name, value);
			}
		}

		return Object.keys(adjustments).length > 0 ? adjustments : undefined;
	}

	/**
	 * Parse adjustment handles from `a:ahLst` in a geometry definition.
	 * Supports both `a:ahXY` (XY position handles) and `a:ahPolar` (polar handles).
	 */
	protected parseAdjustmentHandles(
		geomNode: XmlObject | undefined,
		shapeWidth: number,
		shapeHeight: number,
		adjustments?: Record<string, number>,
	): GeometryAdjustmentHandle[] | undefined {
		if (!geomNode) {
			return undefined;
		}
		const ahLst = geomNode['a:ahLst'] as XmlObject | undefined;
		if (!ahLst) {
			return undefined;
		}

		const handles: GeometryAdjustmentHandle[] = [];

		// Build variable context for resolving min/max positions
		const vars = createBuiltinVariables({
			w: shapeWidth,
			h: shapeHeight,
		});
		if (adjustments) {
			for (const [name, value] of Object.entries(adjustments)) {
				vars.set(name, value);
			}
		}

		// Parse XY adjustment handles
		const xyHandles = this.ensureArray(ahLst['a:ahXY']) as XmlObject[];
		for (const ah of xyHandles) {
			const gdRefX = String(ah?.['@_gdRefX'] ?? '').trim();
			const gdRefY = String(ah?.['@_gdRefY'] ?? '').trim();
			const guideName = gdRefX || gdRefY;
			if (!guideName) {
				continue;
			}

			const pos = ah['a:pos'] as XmlObject | undefined;
			const posX = resolveCoordinate(pos?.['@_x'] as string | number | undefined, vars);
			const posY = resolveCoordinate(pos?.['@_y'] as string | number | undefined, vars);

			const handle: GeometryAdjustmentHandle = {
				guideName,
				xFraction: shapeWidth > 0 ? posX / shapeWidth : undefined,
				yFraction: shapeHeight > 0 ? posY / shapeHeight : undefined,
			};

			// Parse min/max constraints
			if (ah['@_minX'] !== undefined) {
				handle.minValue = resolveCoordinate(ah['@_minX'] as string | number, vars);
			}
			if (ah['@_maxX'] !== undefined) {
				handle.maxValue = resolveCoordinate(ah['@_maxX'] as string | number, vars);
			}
			if (ah['@_minY'] !== undefined && !handle.minValue) {
				handle.minValue = resolveCoordinate(ah['@_minY'] as string | number, vars);
			}
			if (ah['@_maxY'] !== undefined && !handle.maxValue) {
				handle.maxValue = resolveCoordinate(ah['@_maxY'] as string | number, vars);
			}

			handles.push(handle);
		}

		// Parse polar adjustment handles
		const polarHandles = this.ensureArray(ahLst['a:ahPolar']) as XmlObject[];
		for (const ah of polarHandles) {
			const gdRefR = String(ah?.['@_gdRefR'] ?? '').trim();
			const gdRefAng = String(ah?.['@_gdRefAng'] ?? '').trim();
			const guideName = gdRefR || gdRefAng;
			if (!guideName) {
				continue;
			}

			const pos = ah['a:pos'] as XmlObject | undefined;
			const posX = resolveCoordinate(pos?.['@_x'] as string | number | undefined, vars);
			const posY = resolveCoordinate(pos?.['@_y'] as string | number | undefined, vars);

			handles.push({
				guideName,
				xFraction: shapeWidth > 0 ? posX / shapeWidth : undefined,
				yFraction: shapeHeight > 0 ? posY / shapeHeight : undefined,
			});
		}

		return handles.length > 0 ? handles : undefined;
	}

	/**
	 * Extract adjustment, guide, handle, connection, and text-rectangle raw XML from `a:custGeom`
	 * node so they can be re-emitted on save when the geometry is edited.
	 * Returns `undefined` when none of these auxiliary children carry data.
	 */
	protected extractCustomGeometryRawData(
		custGeom: XmlObject | undefined,
	): CustomGeometryRawData | undefined {
		if (!custGeom) {
			return undefined;
		}
		const isNonEmpty = (node: unknown): boolean => {
			if (node === undefined || node === null) {
				return false;
			}
			if (typeof node !== 'object') {
				return true;
			}
			return Object.keys(node as Record<string, unknown>).length > 0;
		};
		const result: CustomGeometryRawData = {};
		const avLst = custGeom['a:avLst'];
		if (isNonEmpty(avLst)) {
			result.avLstXml = avLst;
		}
		const gdLst = custGeom['a:gdLst'];
		if (isNonEmpty(gdLst)) {
			result.gdLstXml = gdLst;
		}
		const ahLst = custGeom['a:ahLst'];
		if (isNonEmpty(ahLst)) {
			result.ahLstXml = ahLst;
		}
		const cxnLst = custGeom['a:cxnLst'];
		if (isNonEmpty(cxnLst)) {
			result.cxnLstXml = cxnLst;
		}
		const rect = custGeom['a:rect'];
		if (isNonEmpty(rect)) {
			result.rectXml = rect;
		}
		return Object.keys(result).length > 0 ? result : undefined;
	}

	/**
	 * URIs recognised by other extractors and therefore already mapped to
	 * typed fields. These should NOT be captured as opaque `extLstXml`.
	 *
	 * - `{AF507438-7753-43E0-B8FC-AC1667EBCBE1}` → `p14:hiddenFill`
	 * - `{91240B29-F687-4F45-9708-019B960494DF}` → `p14:hiddenLine`
	 */
	private static readonly RECOGNISED_SP_PR_EXT_URIS = new Set<string>([
		'{AF507438-7753-43E0-B8FC-AC1667EBCBE1}',
		'{91240B29-F687-4F45-9708-019B960494DF}',
	]);

	/**
	 * Capture unrecognised `<a:ext>` children from `spPr/a:extLst` for
	 * verbatim re-emission. Returns `undefined` when nothing opaque needs
	 * preserving so the slot stays empty for round-trip cleanliness.
	 */
	protected extractOpaqueSpPrExtLst(spPr: XmlObject | undefined): XmlObject[] | undefined {
		if (!spPr) {
			return undefined;
		}
		const extLst = spPr['a:extLst'] as XmlObject | undefined;
		if (!extLst) {
			return undefined;
		}
		const exts = this.ensureArray(extLst['a:ext']) as XmlObject[];
		if (exts.length === 0) {
			return undefined;
		}
		const opaque: XmlObject[] = [];
		for (const ext of exts) {
			const uri = String(ext?.['@_uri'] ?? '').trim();
			if (uri && PptxHandlerRuntime.RECOGNISED_SP_PR_EXT_URIS.has(uri)) {
				continue;
			}
			opaque.push(ext);
		}
		return opaque.length > 0 ? opaque : undefined;
	}

	/**
	 * Extract typed adjustment handles (`a:ahXY` / `a:ahPolar`) from a
	 * `a:custGeom/a:ahLst` node. Coordinate / guide references are preserved
	 * as raw strings so they round-trip verbatim.
	 */
	protected extractCustomGeometryAdjustHandles(custGeom: XmlObject | undefined): {
		xy?: AdjustHandleXY[];
		polar?: AdjustHandlePolar[];
	} {
		const ahLst = custGeom?.['a:ahLst'] as XmlObject | undefined;
		if (!ahLst) {
			return {};
		}
		const toStr = (v: unknown): string | undefined => {
			if (v === undefined || v === null) {
				return undefined;
			}
			const s = String(v);
			return s.length > 0 ? s : undefined;
		};
		const result: { xy?: AdjustHandleXY[]; polar?: AdjustHandlePolar[] } = {};

		const xyNodes = this.ensureArray(ahLst['a:ahXY']) as XmlObject[];
		if (xyNodes.length > 0) {
			const xyHandles: AdjustHandleXY[] = [];
			for (const node of xyNodes) {
				const pos = node?.['a:pos'] as XmlObject | undefined;
				const handle: AdjustHandleXY = {
					gdRefX: toStr(node?.['@_gdRefX']),
					gdRefY: toStr(node?.['@_gdRefY']),
					minX: toStr(node?.['@_minX']),
					maxX: toStr(node?.['@_maxX']),
					minY: toStr(node?.['@_minY']),
					maxY: toStr(node?.['@_maxY']),
					posX: toStr(pos?.['@_x']),
					posY: toStr(pos?.['@_y']),
				};
				xyHandles.push(handle);
			}
			if (xyHandles.length > 0) {
				result.xy = xyHandles;
			}
		}

		const polarNodes = this.ensureArray(ahLst['a:ahPolar']) as XmlObject[];
		if (polarNodes.length > 0) {
			const polarHandles: AdjustHandlePolar[] = [];
			for (const node of polarNodes) {
				const pos = node?.['a:pos'] as XmlObject | undefined;
				const handle: AdjustHandlePolar = {
					gdRefR: toStr(node?.['@_gdRefR']),
					gdRefAng: toStr(node?.['@_gdRefAng']),
					minR: toStr(node?.['@_minR']),
					maxR: toStr(node?.['@_maxR']),
					minAng: toStr(node?.['@_minAng']),
					maxAng: toStr(node?.['@_maxAng']),
					posX: toStr(pos?.['@_x']),
					posY: toStr(pos?.['@_y']),
				};
				polarHandles.push(handle);
			}
			if (polarHandles.length > 0) {
				result.polar = polarHandles;
			}
		}

		return result;
	}

	/**
	 * Extract typed connection sites (`a:cxn`) from `a:custGeom/a:cxnLst`.
	 */
	protected extractCustomGeometryConnectionSites(
		custGeom: XmlObject | undefined,
	): ConnectionSite[] | undefined {
		const cxnLst = custGeom?.['a:cxnLst'] as XmlObject | undefined;
		if (!cxnLst) {
			return undefined;
		}
		const cxnNodes = this.ensureArray(cxnLst['a:cxn']) as XmlObject[];
		if (cxnNodes.length === 0) {
			return undefined;
		}
		const sites: ConnectionSite[] = [];
		for (const node of cxnNodes) {
			const pos = node?.['a:pos'] as XmlObject | undefined;
			const ang = node?.['@_ang'];
			const site: ConnectionSite = {
				ang: ang !== undefined && ang !== null ? String(ang) : undefined,
				posX: pos?.['@_x'] !== undefined ? String(pos['@_x']) : undefined,
				posY: pos?.['@_y'] !== undefined ? String(pos['@_y']) : undefined,
			};
			sites.push(site);
		}
		return sites.length > 0 ? sites : undefined;
	}

	/**
	 * Extract the typed text rectangle (`a:rect`) on a custom geometry.
	 */
	protected extractCustomGeometryTextRect(
		custGeom: XmlObject | undefined,
	): CustomGeometryTextRect | undefined {
		const rect = custGeom?.['a:rect'] as XmlObject | undefined;
		if (!rect) {
			return undefined;
		}
		const result: CustomGeometryTextRect = {};
		if (rect['@_l'] !== undefined) {
			result.l = String(rect['@_l']);
		}
		if (rect['@_t'] !== undefined) {
			result.t = String(rect['@_t']);
		}
		if (rect['@_r'] !== undefined) {
			result.r = String(rect['@_r']);
		}
		if (rect['@_b'] !== undefined) {
			result.b = String(rect['@_b']);
		}
		return Object.keys(result).length > 0 ? result : undefined;
	}

	/**
	 * Build structured `CustomGeometryPath[]` from a parsed `a:custGeom` node,
	 * including per-path `@fill`/`@stroke`/`@extrusionOk` attributes so they
	 * and formula-resolved arc commands survive path-list regeneration.
	 */
	protected buildStructuredCustomGeometryPaths(
		custGeom: XmlObject | undefined,
		pathWidth: number,
		pathHeight: number,
	): CustomGeometryPath[] | undefined {
		if (!custGeom) {
			return undefined;
		}
		const pathLst = custGeom['a:pathLst'] as XmlObject | undefined;
		if (!pathLst) {
			return undefined;
		}
		const pathNodes = this.ensureArray(pathLst['a:path']) as XmlObject[];
		if (pathNodes.length === 0) {
			return undefined;
		}
		const paths = parseStructuredCustomGeometry(custGeom, pathWidth, pathHeight, (value) =>
			this.ensureArray(value),
		);
		return paths.length > 0 ? paths : undefined;
	}

	protected parseCustomGeometry(
		custGeom: XmlObject | undefined,
		shapeWidth?: number,
		shapeHeight?: number,
	): { pathData: string; pathWidth: number; pathHeight: number } | null {
		if (
			!custGeom ||
			!(custGeom as Record<string, unknown>)['a:pathLst'] ||
			!((custGeom as Record<string, unknown>)['a:pathLst'] as Record<string, unknown>)?.['a:path']
		) {
			return null;
		}

		// Parse adjustment values from a:avLst
		const avGdNodes = this.ensureArray(
			(custGeom['a:avLst'] as XmlObject | undefined)?.['a:gd'],
		) as Array<Record<string, unknown>>;
		const adjustments = avGdNodes.length > 0 ? parseAdjustmentValues(avGdNodes) : undefined;

		// Parse guide definitions from a:gdLst
		const gdGdNodes = this.ensureArray(
			(custGeom['a:gdLst'] as XmlObject | undefined)?.['a:gd'],
		) as Array<Record<string, unknown>>;
		const guideDefinitions = parseGuideDefinitions(gdGdNodes);

		// Determine the coordinate space for formula evaluation
		const pathNodes = this.ensureArray((custGeom['a:pathLst'] as XmlObject)['a:path']) as Array<
			Record<string, unknown>
		>;

		// Use the path coordinate dimensions or fall back to shape dimensions
		const firstPath = pathNodes[0];
		const coordW = Number.parseInt(String(firstPath?.['@_w'] ?? '0'), 10) || (shapeWidth ?? 0);
		const coordH = Number.parseInt(String(firstPath?.['@_h'] ?? '0'), 10) || (shapeHeight ?? 0);

		// If we have guide definitions that reference formulas, evaluate them
		const hasFormulas = guideDefinitions.length > 0 || (adjustments && adjustments.size > 0);

		if (hasFormulas) {
			// Evaluate all guides with formula resolution
			const variables = evaluateGuides(guideDefinitions, { w: coordW, h: coordH }, adjustments);

			// Evaluate paths with formula-resolved coordinates
			return evaluateGeometryPaths(pathNodes, variables, (val: unknown) => this.ensureArray(val));
		}

		// No formulas — fall back to simple path parsing (handles plain numeric coordinates)
		return evaluateGeometryPaths(pathNodes, new Map<string, number>(), (val: unknown) =>
			this.ensureArray(val),
		);
	}

	protected parseCropFraction(value: unknown): number | undefined {
		const raw = Number.parseInt(String(value ?? ''), 10);
		if (!Number.isFinite(raw)) {
			return undefined;
		}
		const normalized = Math.max(0, Math.min(100000, raw)) / 100000;
		return normalized;
	}

	protected readImageCropFromBlipFill(
		blipFill: XmlObject | undefined,
	): Pick<PptxImageLikeElement, 'cropLeft' | 'cropTop' | 'cropRight' | 'cropBottom'> {
		// Primary crop source: a:srcRect
		const sourceRect = blipFill?.['a:srcRect'] as XmlObject | undefined;
		if (sourceRect) {
			const cropLeft = this.parseCropFraction(sourceRect['@_l']);
			const cropTop = this.parseCropFraction(sourceRect['@_t']);
			const cropRight = this.parseCropFraction(sourceRect['@_r']);
			const cropBottom = this.parseCropFraction(sourceRect['@_b']);
			return { cropLeft, cropTop, cropRight, cropBottom };
		}

		// Fallback: a:stretch/a:fillRect with non-zero margins also acts as crop
		const stretchNode = blipFill?.['a:stretch'] as XmlObject | undefined;
		const fillRect = stretchNode?.['a:fillRect'] as XmlObject | undefined;
		if (fillRect) {
			const l = this.parseCropFraction(fillRect['@_l']);
			const t = this.parseCropFraction(fillRect['@_t']);
			const r = this.parseCropFraction(fillRect['@_r']);
			const b = this.parseCropFraction(fillRect['@_b']);
			if (l !== undefined || t !== undefined || r !== undefined || b !== undefined) {
				return {
					cropLeft: l,
					cropTop: t,
					cropRight: r,
					cropBottom: b,
				};
			}
		}

		return {};
	}

	protected extractShapeStyle(spPr: XmlObject | undefined, styleNode?: XmlObject): ShapeStyle {
		return this.shapeStyleExtractor.extractShapeStyle(spPr, styleNode);
	}
}
