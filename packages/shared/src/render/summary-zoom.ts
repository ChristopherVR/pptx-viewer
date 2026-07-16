import type { ZoomPptxElement } from 'pptx-viewer-core';

export interface SummaryZoomTargetInfo {
	slideNumber?: number;
	sectionName?: string;
	backgroundColor?: string;
}

export type SummaryZoomTargetLookup = (
	targetSlideIndex: number,
) => SummaryZoomTargetInfo | undefined;

export interface SummaryZoomTileView {
	key: string;
	sectionId: string;
	targetSlideIndex: number;
	label: string;
	slideLabel: string;
	imageSrc?: string;
	backgroundColor: string;
	style: Record<string, string>;
	ariaLabel: string;
}

export interface SummaryZoomView {
	layout: 'grid' | 'fixed';
	containerStyle: Record<string, string>;
	tiles: SummaryZoomTileView[];
	ariaLabel: string;
}

/** Build the ordered, framework-neutral tile model for a Summary Zoom container. */
export function buildSummaryZoomView(
	element: ZoomPptxElement,
	lookup?: SummaryZoomTargetLookup,
): SummaryZoomView | undefined {
	if (element.zoomType !== 'summary' || !element.summaryTargets?.length) {
		return undefined;
	}
	const layout = element.summaryLayout ?? 'grid';
	const columns = Math.max(1, Math.ceil(Math.sqrt(element.summaryTargets.length)));
	const tiles = element.summaryTargets.map((target, index): SummaryZoomTileView => {
		const targetInfo = lookup?.(target.targetSlideIndex);
		const label = target.title || targetInfo?.sectionName || target.sectionId;
		const slideNumber = targetInfo?.slideNumber ?? target.targetSlideIndex + 1;
		return {
			key: `${target.sectionId}:${index}`,
			sectionId: target.sectionId,
			targetSlideIndex: target.targetSlideIndex,
			label,
			slideLabel: `Slide ${slideNumber}`,
			imageSrc: target.imageData,
			backgroundColor: targetInfo?.backgroundColor ?? '#f0f0f0',
			style:
				layout === 'fixed'
					? fixedTileStyle(element, target.x, target.y, target.width, target.height)
					: { position: 'relative', minWidth: '0', minHeight: '0' },
			ariaLabel: `Zoom to section ${label}, slide ${slideNumber}`,
		};
	});
	return {
		layout,
		containerStyle:
			layout === 'fixed'
				? { position: 'relative', width: '100%', height: '100%' }
				: {
						display: 'grid',
						gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
						gap: '4px',
						width: '100%',
						height: '100%',
					},
		tiles,
		ariaLabel: `Summary Zoom with ${tiles.length} sections`,
	};
}

/** Resolve a tile activation to its slide target without relying on DOM state. */
export function resolveSummaryZoomNavigation(
	view: SummaryZoomView | undefined,
	tileIndex: number,
): number | undefined {
	if (!view || !Number.isInteger(tileIndex) || tileIndex < 0) {
		return undefined;
	}
	return view.tiles[tileIndex]?.targetSlideIndex;
}

function fixedTileStyle(
	element: ZoomPptxElement,
	x: number,
	y: number,
	width: number,
	height: number,
): Record<string, string> {
	const safeWidth = Math.max(element.width, 1);
	const safeHeight = Math.max(element.height, 1);
	return {
		position: 'absolute',
		left: percent((x - element.x) / safeWidth),
		top: percent((y - element.y) / safeHeight),
		width: percent(width / safeWidth),
		height: percent(height / safeHeight),
	};
}

function percent(value: number): string {
	return `${Math.round(value * 100_000) / 1_000}%`;
}
