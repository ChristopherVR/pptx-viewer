/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file:
   independent handler-local `const`s, not one statement */
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import {
	advanceChartValueDrag,
	applyChartBuildReveal,
	applyChartPartHighlight,
	beginChartValueDrag,
	ensureChartInteractionStyles,
	findChartPartTarget,
	resolveChartKind,
	withChartTitle,
} from 'pptx-viewer-shared';
import type { ChartValueDragState, ElementAnimationState } from 'pptx-viewer-shared';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { renderChartElement } from '../../utils';
import { formatAxisValue } from '../../utils/chart-helpers';
import { buildReactChartViewModel } from '../../utils/chart-view-model-render';
import { useChartPartSelection } from '../chart-part-selection';
import { BarChart3DContext } from './bar-chart-3d-context';
import { Bar3DChartRenderer } from './Bar3DChartRenderer';
import { SurfaceChart3DContext } from './surface-chart-3d-context';
import { SurfaceChart3DRenderer } from './SurfaceChart3DRenderer';

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
	const dragRef = useRef<ChartValueDragState | null>(null);
	const { selection, setSelection } = useChartPartSelection();
	const [previewData, setPreviewData] = useState<PptxChartData | null>(null);
	const [dragValue, setDragValue] = useState<number | null>(null);
	const [titleDraft, setTitleDraft] = useState<string | null>(null);

	const selectedPart = selection?.elementId === element.id ? selection.part : null;
	const canEdit = editable && Boolean(onUpdateElement);

	// Opt-in interactive 3D surface scene (camera orbit/zoom via OrbitControls).
	// Marks are not selectable/draggable in this mode: a mesh facet has no 2D
	// screen geometry to hit-test against, so value-drag editing stays SVG-only.
	const use3D = useContext(SurfaceChart3DContext);
	const isSurfaceKind = resolveChartKind(element.chartData?.chartType ?? 'bar') === 'surface';

	// Opt-in interactive 3D bar scene (real box meshes, camera orbit/zoom via
	// OrbitControls). Same "marks are not selectable/draggable" caveat as the
	// surface scene above: a mesh box has no 2D screen geometry to hit-test.
	const use3DBar = useContext(BarChart3DContext);
	const isBar3DKind = element.chartData?.chartType === 'bar3D';

	// The drag context comes from the committed data, captured at drag start, so
	// axis ranges do not rescale under the pointer mid-drag.
	const viewModel = useMemo(
		() => (canEdit ? buildReactChartViewModel(element) : null),
		[canEdit, element],
	);

	useEffect(ensureChartInteractionStyles, []);

	// Drop this chart's part selection when it stops being editable (deselected,
	// mode change) so the inspector highlight does not linger.
	//
	// Guarded on `onUpdateElement`, and that guard is load-bearing: the SAME chart
	// element is mounted several times over (the thumbnail rail alone renders one
	// copy per slide), every one of those copies shares this element id, and none
	// of them is editable. Without the guard the read-only copies raced the canvas
	// on every mark click - the canvas set the selection, a rail copy saw
	// `!canEdit && selection.elementId === element.id` and nulled it a render
	// later, so the highlight class was applied and stripped within ~100ms and no
	// mark ever stayed selected. A mount with no way to commit an edit has no
	// business owning (or clearing) the editing selection.
	useEffect(() => {
		if (!onUpdateElement) {
			return;
		}
		if (!canEdit && selection?.elementId === element.id) {
			setSelection(null);
		}
	}, [canEdit, selection, element.id, setSelection, onUpdateElement]);

	// Re-apply the selected-part highlight class after every render: React
	// re-creates the SVG marks on each chart change, dropping DOM-only classes.
	useEffect(() => {
		applyChartPartHighlight(wrapperRef.current, selectedPart);
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
		if (!viewModel || !element.chartData) {
			return;
		}
		const started = beginChartValueDrag({
			part,
			viewModel,
			chartData: element.chartData,
			clientY: e.clientY,
		});
		if (!started) {
			return;
		}
		e.preventDefault();
		// Pointer capture keeps the drag alive when the pointer leaves the mark;
		// guarded because test DOMs (and older browsers) may not implement it.
		try {
			e.currentTarget.setPointerCapture?.(e.pointerId);
		} catch {
			// Non-fatal: the drag still works while the pointer stays over the chart.
		}
		dragRef.current = started;
	};

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const active = dragRef.current;
		if (!active) {
			return;
		}
		const height = wrapperRef.current?.querySelector('svg')?.getBoundingClientRect().height ?? 0;
		const step = advanceChartValueDrag(active, e.clientY, height);
		if (!step) {
			return;
		}
		setPreviewData(step.chartData);
		setDragValue(step.value);
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
			{use3D && isSurfaceKind ? (
				<SurfaceChart3DRenderer element={renderedElement} />
			) : use3DBar && isBar3DKind ? (
				<Bar3DChartRenderer element={renderedElement} />
			) : (
				renderChartElement(renderedElement)
			)}
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
