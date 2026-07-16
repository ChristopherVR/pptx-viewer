import type { PptxChartAxisFormatting, XmlObject } from '../types';

interface XmlLookupLike {
	getChildrenArrayByLocalName(parent: XmlObject | undefined, name: string): XmlObject[];
}

/**
 * Resolve the value-axis ID referenced by a chart-type container.
 *
 * OOXML stores axis references on the container, not on each `c:ser`. The
 * model stores the effective value axis on every series so renderers can map
 * primary and secondary values independently.
 */
export function resolveChartContainerValueAxisId(
	container: XmlObject | undefined,
	axes: ReadonlyArray<PptxChartAxisFormatting>,
	xmlLookup: XmlLookupLike,
): number | undefined {
	const referencedIds = xmlLookup
		.getChildrenArrayByLocalName(container, 'axId')
		.map((node) => Number.parseInt(String(node['@_val']), 10))
		.filter(Number.isFinite);

	// The Y/value axis is last for scatter-like containers, while category
	// charts have only one referenced valAx. Searching from the end covers both.
	for (let index = referencedIds.length - 1; index >= 0; index--) {
		const id = referencedIds[index];
		if (axes.some((axis) => axis.axisType === 'valAx' && axis.axisId === id)) {
			return id;
		}
	}
	return undefined;
}
