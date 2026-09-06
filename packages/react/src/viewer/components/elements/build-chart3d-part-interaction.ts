/**
 * Click/drag wiring for the interactive 3D chart scenes (bar3D/line3D/area3D/
 * pie3D/surface3D), mirroring `use-chart-mark-interaction.ts`'s effect on the
 * SAME `ChartPartSelectionProvider` selection context and `onUpdateElement`
 * commit path, so `ChartDataPanel` reacts to a 3D mark exactly like a 2D one.
 *
 * The mesh's own drag preview is rendered by the scene itself (it owns the
 * world-space calibration via `Chart3DPointerInteractionOptions`);
 * `onValueDragPreview` here only drives the on-canvas value badge, never the
 * chart data - feeding a live-dragged value back into the element would
 * rebuild `buildXChart3DDataForElement`'s options on every pointer-move tick
 * and remount the whole WebGL scene mid-drag.
 *
 * @module build-chart3d-part-interaction
 */
import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import { withChartPointValue } from 'pptx-viewer-shared';
import type { ChartPartRef } from 'pptx-viewer-shared';
import type { Dispatch, SetStateAction } from 'react';

import type { ChartPartSelection } from '../chart-part-selection';
import type { AnyChart3DInteraction } from './chart3d-interaction-hooks';

export interface Chart3DPartInteractionParams {
	element: ChartPptxElement;
	canEdit: boolean;
	onUpdateElement?: (updates: Partial<PptxElement>) => void;
	selection: ChartPartSelection | null;
	setSelection: (selection: ChartPartSelection | null) => void;
	setDragValue: Dispatch<SetStateAction<number | null>>;
}

/**
 * Builds the interaction bag passed to every `mount*Chart3D` call for this
 * element, or `undefined` for a non-editable mount (e.g. the thumbnail rail)
 * so a read-only copy never claims the shared selection - the same rule
 * `use-chart-mark-interaction.ts`'s `!canEdit` guard enforces for the 2D path.
 */
export function buildChart3DPartInteraction({
	element,
	canEdit,
	onUpdateElement,
	selection,
	setSelection,
	setDragValue,
}: Chart3DPartInteractionParams): AnyChart3DInteraction | undefined {
	if (!canEdit) {
		return undefined;
	}

	const onSelect = (part: ChartPartRef | null): void => {
		if (part) {
			setSelection({ elementId: element.id, part });
		} else if (selection?.elementId === element.id) {
			setSelection(null);
		}
	};

	const onValueDragPreview = (_part: ChartPartRef, value: number): void => {
		setDragValue(value);
	};

	const onValueDragCommit = (part: ChartPartRef, value: number): void => {
		setDragValue(null);
		if (!onUpdateElement || !element.chartData || part.pointIndex === undefined) {
			return;
		}
		onUpdateElement({
			chartData: withChartPointValue(element.chartData, part.seriesIndex, part.pointIndex, value),
		} as Partial<PptxElement>);
	};

	return { onSelect, onValueDragPreview, onValueDragCommit };
}
