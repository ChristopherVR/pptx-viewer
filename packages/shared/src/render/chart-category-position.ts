import type { PlotLayout } from './chart-view-model';

export function categoryX(
	displayIndex: number,
	count: number,
	layout: PlotLayout,
	spacing: 'bar' | 'line',
): number {
	if (spacing === 'bar') {
		return layout.plotLeft + (layout.plotWidth / Math.max(count, 1)) * (displayIndex + 0.5);
	}
	return count > 1
		? layout.plotLeft + (layout.plotWidth / (count - 1)) * displayIndex
		: layout.plotLeft + layout.plotWidth / 2;
}
