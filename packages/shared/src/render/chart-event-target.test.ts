/**
 * Unit tests for chart-event-target.ts: shadow-DOM aware chart-part
 * hit-testing via `event.composedPath()`. Pure TypeScript, no real DOM: a
 * fake composed path stands in for shadow-root retargeting.
 */
import { describe, expect, it } from 'vitest';

import {
	chartEventPathElements,
	findChartPartElementInEvent,
	findChartPartInEvent,
	isChartTitleEvent,
} from './chart-event-target';
import type { ChartPathEvent } from './chart-event-target';
import {
	CHART_PART_ATTR,
	CHART_PART_POINT_ATTR,
	CHART_PART_SERIES_ATTR,
} from './chart-interaction';

function fakeElement(attrs: Record<string, string>): {
	getAttribute: (name: string) => string | null;
} {
	return { getAttribute: (name) => attrs[name] ?? null };
}

function eventWithPath(path: unknown[]): ChartPathEvent {
	return { target: path[0] ?? null, composedPath: () => path };
}

describe('chartEventPathElements', () => {
	it('returns element-like nodes from composedPath, innermost first', () => {
		const inner = fakeElement({});
		const outer = fakeElement({});
		const notAnElement = { some: 'window' };
		expect(chartEventPathElements(eventWithPath([inner, outer, notAnElement]))).toStrictEqual([
			inner,
			outer,
		]);
	});

	it('falls back to walking parentElement chains when composedPath is absent', () => {
		const grandparent = fakeElement({ id: 'gp' });
		const parent = { ...fakeElement({ id: 'p' }), parentElement: grandparent };
		const child = { ...fakeElement({ id: 'c' }), parentElement: parent };
		const event: ChartPathEvent = { target: child };
		expect(chartEventPathElements(event)).toStrictEqual([child, parent, grandparent]);
	});

	it('returns an empty array when composedPath is empty and target has no ancestors', () => {
		expect(chartEventPathElements(eventWithPath([]))).toStrictEqual([]);
	});
});

describe('findChartPartElementInEvent', () => {
	it('finds the nearest tagged element on the path', () => {
		const leaf = fakeElement({});
		const tagged = fakeElement({ [CHART_PART_ATTR]: 'series', [CHART_PART_SERIES_ATTR]: '0' });
		const shadowRoot = fakeElement({});
		expect(findChartPartElementInEvent(eventWithPath([leaf, tagged, shadowRoot]))).toBe(tagged);
	});

	it('returns null when nothing on the path is tagged', () => {
		expect(
			findChartPartElementInEvent(eventWithPath([fakeElement({}), fakeElement({})])),
		).toBeNull();
	});
});

describe('findChartPartInEvent', () => {
	it('decodes a data-point part from the tagged element on the path', () => {
		const tagged = fakeElement({
			[CHART_PART_ATTR]: 'dataPoint',
			[CHART_PART_SERIES_ATTR]: '2',
			[CHART_PART_POINT_ATTR]: '5',
		});
		expect(findChartPartInEvent(eventWithPath([tagged]))).toStrictEqual({
			role: 'dataPoint',
			seriesIndex: 2,
			pointIndex: 5,
		});
	});

	it('returns null with no tagged element on the path', () => {
		expect(findChartPartInEvent(eventWithPath([fakeElement({})]))).toBeNull();
	});
});

describe('isChartTitleEvent', () => {
	it('is true when the nearest tagged element is the title', () => {
		const title = fakeElement({ [CHART_PART_ATTR]: 'title' });
		expect(isChartTitleEvent(eventWithPath([title]))).toBeTruthy();
	});

	it('is false for a data-point part or no part at all', () => {
		const point = fakeElement({
			[CHART_PART_ATTR]: 'dataPoint',
			[CHART_PART_SERIES_ATTR]: '0',
		});
		expect(isChartTitleEvent(eventWithPath([point]))).toBeFalsy();
		expect(isChartTitleEvent(eventWithPath([]))).toBeFalsy();
	});
});
