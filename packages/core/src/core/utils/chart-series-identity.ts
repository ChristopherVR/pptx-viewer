/**
 * chart-series-identity.ts: `c16:uniqueId` (CT_UniqueId, the Office 2014+
 * `{C3380CC4-5D6E-409C-BE32-E72D297353CC}` chart extension), the GUID
 * PowerPoint uses to track a series' (and, per data point, a data point's)
 * identity across edits and collaborators, independent of its `c:idx`/
 * `c:order` position. Confirmed against the real corpus: it appears on
 * `c:ser/c:extLst` and `c:dPt/c:extLst` in
 * `e2e/fixtures/chart-data-fidelity.pptx` and
 * `packages/core/src/__tests__/fixtures/corpus/smartart-chart-table-mix.pptx`.
 *
 * An untouched, or in-place edited, series/point already round-trips this
 * extension as passthrough: neither `applySeriesDataPointsToXml` (data
 * points) nor the per-series mutation in `PptxHandlerRuntimeSaveDataSerialization`
 * ever deletes or rebuilds the whole `c:ser`/`c:dPt` node, so an untouched
 * `c:extLst` simply stays. The one place this broke down is
 * `buildNewSeriesXml`'s template-clone path: `JSON.parse(JSON.stringify(...))`
 * on an existing series duplicates its `c16:uniqueId` verbatim onto the new
 * series, so two series would share one identity, which PowerPoint's own
 * animation/collaboration targeting keys off. `regenerateClonedUniqueId`
 * exists to fix exactly that.
 *
 * @module utils/chart-series-identity
 */
import type { XmlObject } from '../types';
import type { LocalName } from './chart-ext-lookup';
import { findChartExtByUri, findChildByLocalName } from './chart-ext-lookup';

/** `c:ext/@uri` for the Office 2014 chart `c16:uniqueId` extension. */
export const CHART_UNIQUE_ID_EXT_URI = '{C3380CC4-5D6E-409C-BE32-E72D297353CC}';
const CHART_UNIQUE_ID_NS = 'http://schemas.microsoft.com/office/drawing/2014/chart';

/**
 * Parse a `c:ser` or `c:dPt` node's `c16:uniqueId/@val`, or `undefined` when
 * the node carries no such extension.
 */
export function parseChartUniqueId(
	node: XmlObject | undefined,
	localName: LocalName,
): string | undefined {
	const ext = findChartExtByUri(node, localName, CHART_UNIQUE_ID_EXT_URI);
	const uniqueIdNode = findChildByLocalName(ext, 'uniqueId', localName);
	const val = uniqueIdNode?.['@_val'];
	return typeof val === 'string' && val.length > 0 ? val : undefined;
}

function randomHex(length: number): string {
	let out = '';
	for (let i = 0; i < length; i++) {
		out += Math.floor(Math.random() * 16).toString(16);
	}
	return out;
}

/**
 * Generate a fresh GUID in the `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}` form
 * `c16:uniqueId/@val` uses. Prefers `crypto.randomUUID` (available in every
 * runtime this package targets); falls back to a manual v4-shaped generator
 * so this never throws in an environment without `crypto`.
 */
export function generateChartUniqueId(): string {
	const cryptoObj = typeof crypto === 'undefined' ? undefined : crypto;
	const uuid =
		cryptoObj && typeof cryptoObj.randomUUID === 'function'
			? cryptoObj.randomUUID()
			: `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex(3)}-${randomHex(12)}`;
	return `{${uuid.toUpperCase()}}`;
}

/** Build a fresh `c:extLst` singleton wrapping one `c16:uniqueId`, for a brand-new `c:ser`/`c:dPt`. */
export function buildChartUniqueIdExtLst(uniqueId: string): XmlObject {
	return {
		'c:ext': {
			'@_uri': CHART_UNIQUE_ID_EXT_URI,
			'@_xmlns:c16': CHART_UNIQUE_ID_NS,
			'c16:uniqueId': { '@_val': uniqueId },
		},
	};
}

/**
 * Replace a cloned `c:ser`/`c:dPt` node's `c16:uniqueId` with a fresh GUID,
 * in place. No-op when the clone carries no such extension. Call this on
 * every node produced by cloning an existing node as a template for a new
 * one, so the new node never shares its template's identity.
 */
export function regenerateClonedUniqueId(clonedNode: XmlObject, localName: LocalName): void {
	const ext = findChartExtByUri(clonedNode, localName, CHART_UNIQUE_ID_EXT_URI);
	const uniqueIdNode = findChildByLocalName(ext, 'uniqueId', localName);
	if (uniqueIdNode) {
		uniqueIdNode['@_val'] = generateChartUniqueId();
	}
}
