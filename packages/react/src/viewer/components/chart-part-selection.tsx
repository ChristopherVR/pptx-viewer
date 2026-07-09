/**
 * Chart part selection context: the bridge between on-canvas chart part
 * clicks (ChartElementView) and the chart inspector (ChartDataPanel /
 * ChartDataGrid), without threading props through the canvas layers.
 *
 * The default value is an inert no-op so chart components keep working when
 * rendered outside the viewer (tests, thumbnails).
 */
import type { ChartPartRef } from 'pptx-viewer-shared';
import React, { createContext, useContext, useMemo, useState } from 'react';

/** A selected chart sub-part, scoped to the chart element that owns it. */
export interface ChartPartSelection {
	elementId: string;
	part: ChartPartRef;
}

interface ChartPartSelectionContextValue {
	selection: ChartPartSelection | null;
	setSelection: (selection: ChartPartSelection | null) => void;
}

const ChartPartSelectionContext = createContext<ChartPartSelectionContextValue>({
	selection: null,
	setSelection: () => {},
});

export function ChartPartSelectionProvider({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	const [selection, setSelection] = useState<ChartPartSelection | null>(null);
	const value = useMemo(() => ({ selection, setSelection }), [selection]);
	return (
		<ChartPartSelectionContext.Provider value={value}>
			{children}
		</ChartPartSelectionContext.Provider>
	);
}

export function useChartPartSelection(): ChartPartSelectionContextValue {
	return useContext(ChartPartSelectionContext);
}
