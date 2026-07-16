/** Framework-neutral virtual-list range used by every thumbnail sidebar. */
export interface VirtualizedRange {
	startIndex: number;
	endIndex: number;
	totalHeight: number;
	offsetY: number;
	visibleRange: { start: number; end: number };
}

export const DEFAULT_VIRTUAL_OVERSCAN = 5;
export const SLIDE_VIRTUALIZATION_THRESHOLD = 50;

/** Compute the rendered item window for fixed-height virtual lists. */
export function computeVirtualRange(
	totalItems: number,
	itemHeight: number,
	scrollTop: number,
	viewportHeight: number,
	overscan = DEFAULT_VIRTUAL_OVERSCAN,
): VirtualizedRange {
	const safeCount = Math.max(0, totalItems);
	const safeItemHeight = Math.max(itemHeight, 1);
	const totalHeight = safeCount * safeItemHeight;
	if (safeCount === 0) {
		return {
			startIndex: 0,
			endIndex: -1,
			totalHeight: 0,
			offsetY: 0,
			visibleRange: { start: 0, end: -1 },
		};
	}

	const visibleStart = Math.min(safeCount - 1, Math.max(0, Math.floor(scrollTop / safeItemHeight)));
	const visibleEnd = Math.min(
		safeCount - 1,
		Math.max(visibleStart, Math.floor((scrollTop + Math.max(0, viewportHeight)) / safeItemHeight)),
	);
	const safeOverscan = Math.max(0, overscan);
	const startIndex = Math.max(0, visibleStart - safeOverscan);
	const endIndex = Math.min(safeCount - 1, visibleEnd + safeOverscan);
	return {
		startIndex,
		endIndex,
		totalHeight,
		offsetY: startIndex * safeItemHeight,
		visibleRange: { start: visibleStart, end: visibleEnd },
	};
}
