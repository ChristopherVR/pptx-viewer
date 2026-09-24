/**
 * React-side glue between a chart element's `<pptx-three-view>` and this
 * binding's chart-part selection / value-commit path. Everything that
 * decides WHICH element gets a 3D spec, and what a click/drag on it means,
 * lives in `pptx-viewer-shared` (`resolveChartThreeViewSpec`,
 * `applyChart3DSelect`, `applyChart3DDrag`); this hook only adapts it to
 * `ChartElementView`'s own React state, the SAME state its 2D mark
 * interaction (`useChartMarkInteraction`) already uses, so the chart
 * inspector and undo history react identically to a 2D or a 3D mark.
 *
 * @module use-chart-3d-view
 */
import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import {
	applyChart3DDrag,
	applyChart3DSelect,
	resolveChartThreeViewSpec,
} from 'pptx-viewer-shared';
import type {
	Chart3DFlags,
	Chart3DSelectionBridge,
	ChartPartRef,
	ThreeViewDragDetail,
	ThreeViewSpec,
} from 'pptx-viewer-shared';
import { useMemo } from 'react';

import type { ChartPartSelection } from '../chart-part-selection';

export interface UseChart3DViewOptions {
	element: ChartPptxElement;
	/** The host's opt-in flags, already narrowed to the viewer user's own Options > Advanced override. */
	flags: Partial<Chart3DFlags> | null | undefined;
	canEdit: boolean;
	onUpdateElement?: (updates: Partial<PptxElement>) => void;
	selection: ChartPartSelection | null;
	setSelection: (selection: ChartPartSelection | null) => void;
	setDragValue: (value: number | null) => void;
}

export interface Chart3DView {
	/** `null` when this element/chart type does not resolve to a 3D scene: render the 2D path only. */
	spec: ThreeViewSpec | null;
	onSelect: (part: ChartPartRef | null) => void;
	onDrag: (detail: ThreeViewDragDetail) => void;
}

/** The `<pptx-three-view>` spec for a chart element, plus its event handlers. */
export function useChart3DView({
	element,
	flags,
	canEdit,
	onUpdateElement,
	selection,
	setSelection,
	setDragValue,
}: UseChart3DViewOptions): Chart3DView {
	const spec = useMemo(() => resolveChartThreeViewSpec(element, flags), [element, flags]);

	const bridge: Chart3DSelectionBridge = {
		elementId: element.id,
		chartData: element.chartData,
		canSelect: canEdit,
		selectedElementId: selection?.elementId ?? null,
		setSelection,
		setDragValue,
		commitChartData: onUpdateElement
			? (next) => onUpdateElement({ chartData: next } as Partial<PptxElement>)
			: undefined,
	};

	return {
		spec,
		onSelect: (part) => applyChart3DSelect(bridge, part),
		onDrag: (detail) => applyChart3DDrag(bridge, detail),
	};
}
