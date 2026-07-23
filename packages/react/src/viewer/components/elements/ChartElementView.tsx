import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import {
	applyChartBuildReveal,
	dragAnchorViewY,
	dragValueForPart,
	findChartPartTarget,
	withChartPointValue,
	withChartTitle,
} from 'pptx-viewer-shared';
import type { ChartPartRef, ChartValueDrag, ElementAnimationState } from 'pptx-viewer-shared';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { renderChartElement } from '../../utils';
import { formatAxisValue } from '../../utils/chart-helpers';
import { buildReactChartViewModel } from '../../utils/chart-view-model-render';
import { useChartPartSelection } from '../chart-part-selection';

/** Minimum pointer travel (px) before a mark press becomes a value drag. */
const DRAG_THRESHOLD_PX = 3;

const STYLE_ELEMENT_ID = 'pptx-chart-interaction-styles';
const INTERACTION_CSS = `
.pptx-chart-interactive svg [data-chart-part] { pointer-events: auto; cursor: pointer; }
.pptx-chart-interactive svg [data-chart-part]:hover { filter: brightness(1.12); }
.pptx-chart-interactive svg [data-chart-part='title'] { cursor: text; }
.pptx-chart-interactive svg .pptx-chart-part-selected { filter: drop-shadow(0 0 2.5px #3b82f6); }
.pptx-chart-interactive svg .pptx-chart-part-selected:hover { filter: drop-shadow(0 0 2.5px #3b82f6) brightness(1.12); }
`;

/** Inject the (singleton) interaction stylesheet for chart part hit targets. */
function ensureInteractionStyles(): void {
	if (typeof document === 'undefined' || document.getElementById(STYLE_ELEMENT_ID)) {
		return;
	}
	const style = document.createElement('style');
	style.id = STYLE_ELEMENT_ID;
	style.textContent = INTERACTION_CSS;
	document.head.appendChild(style);
}

interface ActiveValueDrag {
	part: ChartPartRef;
	drag: ChartValueDrag;
	svgHeight: number;
	startClientY: number;
	/** View-box Y of the point's value at drag start; the drag tracks deltas from here. */
	anchorViewY: number;
	baseChartData: PptxChartData;
	moved: boolean;
	lastData: PptxChartData | null;
}

export interface ChartElementViewProps {
	element: ChartPptxElement;
	/** True when the chart is selected and interactive: activates part hit targets. */
	editable: boolean;
	/** Commits a chart-data edit through the normal element-update/history path. */
	onUpdateElement?: (updates: Partial<PptxElement>) => void;
	/**
	 * Playback state for the chart. When it carries a staged chart build
	 * (`build.kind === 'chart'`), the chart reveals its series / categories /
	 * cells progressively via {@link applyChartBuildReveal}.
	 */
	animationState?: ElementAnimationState;
}

/**
 * Renders a chart element and, in edit mode, makes its data marks directly
 * manipulable: click a bar/dot/slice to select that series/point (synced with
 * the chart inspector), drag a mark vertically to change its value (cartesian
 * kinds), and double-click the title to edit it in place.
 */
export function ChartElementView({
	element,
	editable,
	onUpdateElement,
	animationState,
}: ChartElementViewProps): React.ReactElement {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<ActiveValueDrag | null>(null);
	const { selection, setSelection } = useChartPartSelection();
	const [previewData, setPreviewData] = useState<PptxChartData | null>(null);
	const [dragValue, setDragValue] = useState<number | null>(null);
	const [titleDraft, setTitleDraft] = useState<string | null>(null);

	const selectedPart = selection?.elementId === element.id ? selection.part : null;
	const canEdit = editable && Boolean(onUpdateElement);

	// The drag context comes from the committed data, captured at drag start, so
	// axis ranges do not rescale under the pointer mid-drag.
	const viewModel = useMemo(
		() => (canEdit ? buildReactChartViewModel(element) : null),
		[canEdit, element],
	);

	useEffect(ensureInteractionStyles, []);

	// Drop this chart's part selection when it stops being editable (deselected,
	// mode change) so the inspector highlight does not linger.
	useEffect(() => {
		if (!canEdit && selection?.elementId === element.id) {
			setSelection(null);
		}
	}, [canEdit, selection, element.id, setSelection]);

	// Re-apply the selected-part highlight class after every render: React
	// re-creates the SVG marks on each chart change, dropping DOM-only classes.
	useEffect(() => {
		const root = wrapperRef.current;
		if (!root) {
			return;
		}
		for (const node of root.querySelectorAll('.pptx-chart-part-selected')) {
			node.classList.remove('pptx-chart-part-selected');
		}
		if (!selectedPart) {
			return;
		}
		const pointSel =
			selectedPart.pointIndex !== undefined
				? `[data-chart-point='${selectedPart.pointIndex}']`
				: ':not([data-chart-point])';
		const selector = `[data-chart-part='${selectedPart.role}'][data-chart-series='${selectedPart.seriesIndex}']${pointSel}`;
		for (const node of root.querySelectorAll(selector)) {
			node.classList.add('pptx-chart-part-selected');
		}
	});

	const endDrag = (commit: boolean) => {
		const active = dragRef.current;
		dragRef.current = null;
		setPreviewData(null);
		setDragValue(null);
		if (commit && active?.moved && active.lastData && onUpdateElement) {
			onUpdateElement({ chartData: active.lastData } as Partial<PptxElement>);
		}
	};

	// Cancel an in-flight value drag with Escape.
	useEffect(() => {
		if (dragValue === null) {
			return;
		}
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				endDrag(false);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!canEdit) {
			return;
		}
		const part = findChartPartTarget(e.target);
		if (!part) {
			return;
		}
		e.stopPropagation();
		setSelection({ elementId: element.id, part });
		if (
			part.role === 'dataPoint' &&
			part.pointIndex !== undefined &&
			viewModel?.valueDrag &&
			element.chartData
		) {
			e.preventDefault();
			// Pointer capture keeps the drag alive when the pointer leaves the mark;
			// guarded because test DOMs (and older browsers) may not implement it.
			try {
				e.currentTarget.setPointerCapture?.(e.pointerId);
			} catch {
				// Non-fatal: the drag still works while the pointer stays over the chart.
			}
			const startValue = element.chartData.series[part.seriesIndex]?.values[part.pointIndex] ?? 0;
			dragRef.current = {
				part,
				drag: viewModel.valueDrag,
				svgHeight: viewModel.svgHeight,
				startClientY: e.clientY,
				anchorViewY: dragAnchorViewY(startValue, viewModel.valueDrag, part.seriesIndex),
				baseChartData: element.chartData,
				moved: false,
				lastData: null,
			};
		}
	};

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const active = dragRef.current;
		if (!active) {
			return;
		}
		if (!active.moved && Math.abs(e.clientY - active.startClientY) < DRAG_THRESHOLD_PX) {
			return;
		}
		const svg = wrapperRef.current?.querySelector('svg');
		if (!svg || active.part.pointIndex === undefined) {
			return;
		}
		const rect = svg.getBoundingClientRect();
		if (rect.height === 0) {
			return;
		}
		active.moved = true;
		const deltaViewY = ((e.clientY - active.startClientY) / rect.height) * active.svgHeight;
		const viewY = active.anchorViewY + deltaViewY;
		const value = dragValueForPart(viewY, active.drag, active.part.seriesIndex);
		active.lastData = withChartPointValue(
			active.baseChartData,
			active.part.seriesIndex,
			active.part.pointIndex,
			value,
		);
		setPreviewData(active.lastData);
		setDragValue(value);
	};

	const handlePointerUp = () => {
		if (dragRef.current) {
			endDrag(true);
		}
	};

	const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!canEdit) {
			return;
		}
		const target = e.target as Partial<Element>;
		if (typeof target.closest !== 'function') {
			return;
		}
		if ((target as Element).closest("[data-chart-part='title']")) {
			e.stopPropagation();
			setTitleDraft(element.chartData?.title ?? '');
			return;
		}
		if (findChartPartTarget(e.target)) {
			// A mark double-click is already handled as two selects; keep it from
			// bubbling into the element-level inline-text-edit handler.
			e.stopPropagation();
		}
	};

	const commitTitle = () => {
		if (titleDraft !== null && element.chartData && onUpdateElement) {
			onUpdateElement({
				chartData: withChartTitle(element.chartData, titleDraft),
			} as Partial<PptxElement>);
		}
		setTitleDraft(null);
	};

	// Base chart data (a live drag preview wins over the committed data), then the
	// staged-build reveal trims it to the stages shown at the current progress.
	const baseChartData = previewData ?? element.chartData;
	const chartBuild = animationState?.build?.kind === 'chart' ? animationState.build : undefined;
	const revealedChartData =
		chartBuild && baseChartData ? applyChartBuildReveal(baseChartData, chartBuild) : baseChartData;
	const renderedElement: ChartPptxElement =
		revealedChartData === element.chartData
			? element
			: { ...element, chartData: revealedChartData };

	return (
		<div
			ref={wrapperRef}
			className={`relative w-full h-full ${canEdit ? 'pptx-chart-interactive' : ''}`}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onDoubleClick={handleDoubleClick}
		>
			{renderChartElement(renderedElement)}
			{dragValue !== null && (
				<div className='absolute top-1 right-1 z-10 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-white pointer-events-none'>
					{formatAxisValue(dragValue)}
				</div>
			)}
			{titleDraft !== null && (
				<input
					type='text'
					autoFocus
					value={titleDraft}
					className='absolute left-1/2 top-0.5 z-10 w-3/5 -translate-x-1/2 rounded border border-border bg-background px-1 py-0.5 text-center text-[11px] text-foreground shadow'
					onChange={(e) => setTitleDraft(e.target.value)}
					onPointerDown={(e) => e.stopPropagation()}
					onDoubleClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							commitTitle();
						} else if (e.key === 'Escape') {
							setTitleDraft(null);
						}
						e.stopPropagation();
					}}
					onBlur={commitTitle}
				/>
			)}
		</div>
	);
}
