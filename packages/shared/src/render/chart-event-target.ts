/**
 * Chart-part hit-testing from a DOM event, shadow-DOM aware.
 *
 * A 3D chart renders inside `<pptx-three-view>`, whose canvas and HTML/SVG
 * chrome live in the element's (open) shadow root. An event from inside it is
 * retargeted to the host by the time a binding's listener sees it, so
 * `event.target.closest('[data-chart-part]')` never reaches a tagged node in
 * the chrome. `event.composedPath()` still lists every node the event passed
 * through, shadow internals included, so every binding resolves chart parts
 * from the path instead of from `event.target`.
 *
 * @module chart-event-target
 */
import type { ChartPartElement } from './chart-interaction';
import { CHART_PART_ATTR, chartPartFromElement } from './chart-interaction';
import type { ChartPartRef } from './chart-view-model';

/** The minimal event surface these helpers read (a DOM `Event` satisfies it). */
export interface ChartPathEvent {
	readonly target: unknown;
	composedPath?: () => readonly unknown[];
}

function isPathElement(node: unknown): node is ChartPartElement {
	return (
		Boolean(node) &&
		typeof node === 'object' &&
		typeof (node as Partial<ChartPartElement>).getAttribute === 'function'
	);
}

/**
 * The elements an event travelled through, innermost first, crossing open
 * shadow roots. Falls back to walking `target`'s ancestors when the event has
 * no composed path (a synthetic event built in a test, or after dispatch).
 */
export function chartEventPathElements(event: ChartPathEvent): ChartPartElement[] {
	const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
	if (path.length > 0) {
		return path.filter(isPathElement);
	}
	const out: ChartPartElement[] = [];
	let node: unknown = event.target;
	while (isPathElement(node)) {
		out.push(node);
		node = (node as { parentElement?: unknown }).parentElement ?? null;
	}
	return out;
}

/** The nearest `[data-chart-part]` element on the event's path, or `null`. */
export function findChartPartElementInEvent(event: ChartPathEvent): ChartPartElement | null {
	for (const el of chartEventPathElements(event)) {
		if (el.getAttribute(CHART_PART_ATTR) !== null) {
			return el;
		}
	}
	return null;
}

/**
 * The chart data part (series / data point) under the event, or `null`.
 * Shadow-DOM aware replacement for `findChartPartTarget(event.target)`.
 */
export function findChartPartInEvent(event: ChartPathEvent): ChartPartRef | null {
	return chartPartFromElement(findChartPartElementInEvent(event));
}

/** Whether the event landed on the chart title (`[data-chart-part='title']`). */
export function isChartTitleEvent(event: ChartPathEvent): boolean {
	return findChartPartElementInEvent(event)?.getAttribute(CHART_PART_ATTR) === 'title';
}
