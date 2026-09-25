import type { ChartSvgGradientStop } from 'pptx-viewer-shared';
import React from 'react';

/** The `<stop>` children of a chart gradient def (see `chart-gradient-defs.ts` in shared). */
export function renderGradientStops(stops: readonly ChartSvgGradientStop[]): React.ReactNode[] {
	return stops.map((stop, i) => (
		<stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
	));
}
