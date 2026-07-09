/**
 * chart-part-selection.service.ts: the bridge between on-canvas chart part
 * clicks (`ChartElementViewComponent`) and the chart inspector
 * (`ChartDataEditorComponent`), without threading state through the canvas
 * layers. The Angular counterpart of React's `ChartPartSelectionContext`.
 *
 * Provided at the viewer level (`PowerPointViewerComponent`); consumers
 * inject it `optional` so chart components keep working when rendered
 * outside the viewer subtree (thumbnails, export, tests).
 */
import { Injectable, signal } from '@angular/core';

import type { ChartPartRef } from '../internal/shared';

/** A selected chart sub-part, scoped to the chart element that owns it. */
export interface ChartPartSelection {
	elementId: string;
	part: ChartPartRef;
}

@Injectable()
export class ChartPartSelectionService {
	/** The current on-canvas chart part selection, or null. */
	readonly selection = signal<ChartPartSelection | null>(null);

	/** Select a chart part (replaces any previous selection). */
	select(selection: ChartPartSelection): void {
		this.selection.set(selection);
	}

	/** Clear the selection entirely. */
	clear(): void {
		this.selection.set(null);
	}

	/** Clear the selection when it belongs to the given chart element. */
	clearForElement(elementId: string): void {
		if (this.selection()?.elementId === elementId) {
			this.selection.set(null);
		}
	}
}
