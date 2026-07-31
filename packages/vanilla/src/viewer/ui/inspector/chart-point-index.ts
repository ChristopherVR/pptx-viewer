/**
 * chart-point-index.ts: the "Data Point Index" picker shared by the vanilla
 * chart inspector's advanced and exhaustive sections.
 *
 * WHY it is its own module: both sections author `c:dPt` overrides for ONE
 * point of the selected series (the advanced block owns the point fill and the
 * pie slice explosion, the exhaustive block owns the per-point marker and
 * invert-if-negative), yet only the advanced block owned the index box. The
 * exhaustive block hard-wired `dataPoints[0]`, so the box looked decorative:
 * every marker override landed on the first point no matter what the user
 * typed. Hoisting the field here lets both sections read one selection, which
 * is also what React/Vue/Angular/Svelte give the user, they just spell it as a
 * row per category rather than a number box.
 *
 * The value shown is 1-based because PowerPoint numbers points from 1;
 * {@link ChartPointIndexField.selected} converts to the 0-based SOURCE index,
 * which is the `c:idx` a `c:dPt` carries and the key
 * `resolveDataPointMarker` in `pptx-viewer-shared` looks up when painting.
 */
import type { Translator } from '../../i18n';
import { number } from './chart-exhaustive-controls';

export interface ChartPointIndexField {
	/** The `<label>` wrapper, appended by whichever section renders the field. */
	label: HTMLElement;
	control: HTMLInputElement;
	/** The chosen point as a 0-based `c:idx`, never negative. */
	selected(): number;
	/** Run `listener` whenever the user picks a different point. */
	subscribe(listener: () => void): void;
}

/** Build the shared point picker. */
export function createChartPointIndexField(doc: Document, t: Translator): ChartPointIndexField {
	const { label, control } = number(doc, t('pptx.chart.dataPointIndex'));
	control.min = '1';
	control.value = '1';
	return {
		label,
		control,
		// An empty or sub-1 box means "the first point": the sections must always
		// have a concrete target, otherwise a half-typed value would silently
		// discard the edit.
		selected: () => Math.max(0, (control.valueAsNumber || 1) - 1),
		subscribe: (listener) => control.addEventListener('change', listener),
	};
}
