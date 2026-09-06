/**
 * The 2D SVG chart mark click/drag state machine used by `ChartElementView`:
 * click a bar/dot/slice to select it (synced with the chart inspector via
 * `ChartPartSelectionProvider`), then drag it vertically (cartesian kinds) or
 * along its own angle/radial/segment axis (pie/doughnut/radar/stacked) to
 * change its value.
 *
 * Extracted out of `ChartElementView.tsx` purely to keep that file under the
 * repo's per-file LOC budget; this is plain 2D pointer-event plumbing with no
 * bearing on the 3D chart scenes (see `use-chart3d-part-interaction.ts` for
 * their click/drag wiring).
 *
 * @module use-chart-mark-interaction
 */
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import {
	advanceChartMarkDrag,
	advanceChartValueDrag,
	beginChartMarkDrag,
	beginChartValueDrag,
	buildChartMarkDragGeometry,
	findChartPartTarget,
	resolveChartKind,
} from 'pptx-viewer-shared';
import type { ChartMarkDragState, ChartValueDragState, ChartViewModel } from 'pptx-viewer-shared';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import React, { useEffect, useRef, useState } from 'react';

import type { ChartPartSelection } from '../chart-part-selection';

export interface ChartMarkInteractionParams {
	element: ChartPptxElement;
	canEdit: boolean;
	onUpdateElement?: (updates: Partial<PptxElement>) => void;
	viewModel: ChartViewModel | null;
	wrapperRef: RefObject<HTMLDivElement | null>;
	setSelection: (selection: ChartPartSelection | null) => void;
}

export interface ChartMarkInteractionResult {
	/** A live drag preview of the chart data (wins over the committed data while dragging). */
	previewData: PptxChartData | null;
	/** The dragged mark's live value, for the on-canvas value badge. */
	dragValue: number | null;
	setDragValue: Dispatch<SetStateAction<number | null>>;
	handlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
	handlePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
	handlePointerUp: () => void;
}

export function useChartMarkInteraction({
	element,
	canEdit,
	onUpdateElement,
	viewModel,
	wrapperRef,
	setSelection,
}: ChartMarkInteractionParams): ChartMarkInteractionResult {
	const dragRef = useRef<ChartValueDragState | null>(null);
	// Pie/doughnut slice, radar vertex, and stacked/percentStacked segment drags
	// have no single vertical value axis, so they run through a parallel state
	// machine (chart-interaction-mark-drag.ts) instead of dragRef's cartesian one.
	const markDragRef = useRef<ChartMarkDragState | null>(null);
	const [previewData, setPreviewData] = useState<PptxChartData | null>(null);
	const [dragValue, setDragValue] = useState<number | null>(null);

	const endDrag = (commit: boolean) => {
		const active = dragRef.current;
		const markActive = markDragRef.current;
		dragRef.current = null;
		markDragRef.current = null;
		setPreviewData(null);
		setDragValue(null);
		if (!commit || !onUpdateElement) {
			return;
		}
		if (active?.moved && active.lastData) {
			onUpdateElement({ chartData: active.lastData } as Partial<PptxElement>);
		} else if (markActive?.moved && markActive.lastData) {
			onUpdateElement({ chartData: markActive.lastData } as Partial<PptxElement>);
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
		let captured = false;
		// Pie/doughnut/radar/stacked marks: try the angle/radial/segment drag first.
		const chartKind = resolveChartKind(element.chartData.chartType ?? 'bar');
		if (part.pointIndex !== undefined && chartKind !== 'unsupported') {
			const markGeometry = buildChartMarkDragGeometry({
				kind: chartKind,
				element,
				chartData: element.chartData,
				categoryLabels: element.chartData.categories,
				seriesIndex: part.seriesIndex,
				pointIndex: part.pointIndex,
			});
			const startedMark = beginChartMarkDrag({
				part,
				geometry: markGeometry,
				chartData: element.chartData,
				svgWidth: viewModel.svgWidth,
				svgHeight: viewModel.svgHeight,
				clientX: e.clientX,
				clientY: e.clientY,
			});
			if (startedMark) {
				markDragRef.current = startedMark;
				captured = true;
			}
		}
		// Clustered bar/line/scatter/bubble: the existing vertical value-axis drag.
		if (!captured) {
			const started = beginChartValueDrag({
				part,
				viewModel,
				chartData: element.chartData,
				clientY: e.clientY,
			});
			if (started) {
				dragRef.current = started;
				captured = true;
			}
		}
		if (!captured) {
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
	};

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const markActive = markDragRef.current;
		if (markActive) {
			const rect = wrapperRef.current?.querySelector('svg')?.getBoundingClientRect();
			if (!rect) {
				return;
			}
			const step = advanceChartMarkDrag(markActive, e.clientX, e.clientY, rect);
			if (!step) {
				return;
			}
			setPreviewData(step.chartData);
			setDragValue(step.value);
			return;
		}
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
		if (dragRef.current || markDragRef.current) {
			endDrag(true);
		}
	};

	return {
		previewData,
		dragValue,
		setDragValue,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
	};
}
