/**
 * Pure serialization helper for writing per-data-point overrides (`c:dPt`
 * inside `c:ser`) back into the parsed chart XML on save.
 *
 * Reconciles the modeled `dataPoints` (keyed by `c:idx`) against the existing
 * `c:dPt` nodes: it updates matched points in place (preserving unmodeled
 * children), inserts new ones in schema order, and removes points that are no
 * longer modeled. Dependency-light (a `getLocalName` resolver only) so it can
 * be unit-tested directly.
 *
 * @module utils/chart-datapoint-serializer
 */

import type { PptxChartDataPoint, XmlObject } from '../types';
import type { ResolveChartColor } from './chart-color-choice';
import { buildDptPictureOptions } from './chart-datapoint-picture';
import { buildChartMarkerXml } from './chart-marker-serializer';
import { writeChartShapeProps } from './chart-shape-props-writer';

export {
	parseChartDataPointPicture,
	parseChartDataPointPictureBlipRel,
} from './chart-datapoint-picture';

type GetLocalName = (key: string) => string;

/** CT_Ser children that follow `c:dPt` in schema order. */
const AFTER_DPT = new Set([
	'dLbls',
	'trendline',
	'errBars',
	'cat',
	'val',
	'xVal',
	'yVal',
	'bubbleSize',
	'bubble3D',
	'smooth',
	'extLst',
]);

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function ensureArray<T>(v: T | T[] | undefined): T[] {
	if (v === undefined) {
		return [];
	}
	return Array.isArray(v) ? v : [v];
}

/**
 * Build/merge the `c:spPr` for a data point from its modeled shape props.
 * Delegates to the shared {@link writeChartShapeProps} writer so a stroke
 * width or dash-style edit is not silently dropped: the ad-hoc writer this
 * replaced only ever re-emitted `fillColor`, even though
 * `parseShapeProps` (chart-series-detail-parser.ts) has always read the full
 * fill/stroke-colour/width/dash shape back out of an authored `c:dPt/c:spPr`.
 */
function buildDptSpPr(
	existing: XmlObject | undefined,
	dp: PptxChartDataPoint,
	getLocalName: GetLocalName,
	resolveColor?: ResolveChartColor,
): XmlObject | undefined {
	const props = dp.spPr;
	if (!props) {
		return existing;
	}
	return writeChartShapeProps(existing, props, getLocalName, resolveColor);
}

/** Local names this serializer owns; everything else on the existing node is preserved. */
const MODELED = new Set([
	'idx',
	'invertIfNegative',
	'marker',
	'bubble3D',
	'explosion',
	'spPr',
	'pictureOptions',
]);

function assertDataPoint(dp: PptxChartDataPoint): void {
	if (!Number.isInteger(dp.idx) || dp.idx < 0 || dp.idx > 0xffffffff) {
		throw new RangeError('data point idx must be an unsigned 32-bit integer');
	}
	if (
		dp.explosion !== undefined &&
		(!Number.isInteger(dp.explosion) || dp.explosion < 0 || dp.explosion > 0xffffffff)
	) {
		throw new RangeError('data point explosion must be an unsigned 32-bit integer');
	}
}

/** Build a single `c:dPt` node in schema order, reusing unmodeled children. */
function buildDataPoint(
	existing: XmlObject | undefined,
	dp: PptxChartDataPoint,
	getLocalName: GetLocalName,
	resolveColor?: ResolveChartColor,
): XmlObject {
	assertDataPoint(dp);
	const node: XmlObject = {};
	node['c:idx'] = { '@_val': String(dp.idx) };
	if (dp.invertIfNegative !== undefined) {
		node['c:invertIfNegative'] = { '@_val': dp.invertIfNegative ? '1' : '0' };
	}
	const existingMarker = existing
		? (existing[findKey(existing, 'marker', getLocalName) ?? ''] as XmlObject | undefined)
		: undefined;
	if (dp.marker) {
		node['c:marker'] = buildChartMarkerXml(existingMarker, dp.marker, getLocalName, resolveColor);
	} else if (existingMarker) {
		node['c:marker'] = existingMarker;
	}
	if (dp.bubble3D !== undefined) {
		node['c:bubble3D'] = { '@_val': dp.bubble3D ? '1' : '0' };
	} else if (existing) {
		const bubbleKey = findKey(existing, 'bubble3D', getLocalName);
		if (bubbleKey) {
			node[bubbleKey] = existing[bubbleKey];
		}
	}
	if (dp.explosion !== undefined) {
		node['c:explosion'] = { '@_val': String(dp.explosion) };
	}
	const existingSpPr = existing
		? (existing[findKey(existing, 'spPr', getLocalName) ?? ''] as XmlObject | undefined)
		: undefined;
	const spPr = buildDptSpPr(existingSpPr, dp, getLocalName, resolveColor);
	if (spPr) {
		node['c:spPr'] = spPr;
	}
	const existingPictureOptions = existing
		? (existing[findKey(existing, 'pictureOptions', getLocalName) ?? ''] as XmlObject | undefined)
		: undefined;
	const pictureOptions = buildDptPictureOptions(existingPictureOptions, dp.picture);
	if (pictureOptions) {
		node['c:pictureOptions'] = pictureOptions;
	}
	// Preserve children the model does not capture (e.g. extLst).
	if (existing) {
		for (const key of Object.keys(existing)) {
			if (key.startsWith('@_') || key === '#text') {
				continue;
			}
			if (!MODELED.has(getLocalName(key))) {
				node[key] = existing[key];
			}
		}
	}
	return node;
}

/**
 * Apply the model's per-point overrides onto a `c:ser` node. Replaces the
 * series' `c:dPt` children (in schema order, before `c:dLbls`/`c:cat`/`c:val`),
 * reusing matched existing nodes by `c:idx` to preserve unmodeled styling. An
 * empty/undefined `dataPoints` removes all `c:dPt`. Mutates `seriesNode`.
 */
export function applySeriesDataPointsToXml(
	seriesNode: XmlObject,
	dataPoints: PptxChartDataPoint[] | undefined,
	getLocalName: GetLocalName,
	resolveColor?: ResolveChartColor,
): void {
	const existingKey = findKey(seriesNode, 'dPt', getLocalName);
	const existingNodes = (existingKey ? ensureArray(seriesNode[existingKey]) : []) as XmlObject[];

	// Index existing nodes by their c:idx so we can reuse unmodeled children.
	const byIdx = new Map<number, XmlObject>();
	for (const node of existingNodes) {
		const idxNode = node[findKey(node, 'idx', getLocalName) ?? ''] as XmlObject | undefined;
		const idx = idxNode ? Number.parseInt(String(idxNode['@_val']), 10) : NaN;
		if (Number.isFinite(idx)) {
			byIdx.set(idx, node);
		}
	}

	const points = dataPoints ?? [];
	const built = points.map((dp) =>
		buildDataPoint(byIdx.get(dp.idx), dp, getLocalName, resolveColor),
	);

	if (existingKey) {
		delete seriesNode[existingKey];
	}
	if (built.length === 0) {
		return;
	}

	// Re-insert `c:dPt` before the first following child in schema order.
	const keys = Object.keys(seriesNode);
	const beforeIdx = keys.findIndex((k) => AFTER_DPT.has(getLocalName(k)));
	const value = built.length === 1 ? built[0] : built;
	const entries = keys.map((k) => [k, seriesNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, ['c:dPt', value] as const);
	for (const k of keys) {
		delete seriesNode[k];
	}
	for (const [k, v] of entries) {
		seriesNode[k] = v;
	}
}
