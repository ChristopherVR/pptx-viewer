import type { PptxChartData, XmlObject } from '../types';
import { applyChartPivotSource } from './chart-pivot-source';
import { applyGeneratedChartProtection } from './chart-protection';

/** Apply editable chart-space metadata to a newly generated classic chart part. */
export function applyGeneratedChartSpaceMetadata(tree: XmlObject, data: PptxChartData): void {
	applyGeneratedChartProtection(tree, data.protection);
	const chartSpace = tree['c:chartSpace'];
	if (
		data.pivotSource &&
		chartSpace &&
		typeof chartSpace === 'object' &&
		!Array.isArray(chartSpace)
	) {
		applyChartPivotSource(chartSpace as XmlObject, data.pivotSource, (key) =>
			key.replace(/^.*:/u, ''),
		);
	}
}
