import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { collapseChartTitleRunsForEdit, resolveChartTitleRunSpans } from './chart-title-runs';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		title: 'Sales Q1',
		categories: ['A', 'B'],
		series: [{ name: 'S1', values: [1, 2] }],
		...overrides,
	};
}

describe('resolveChartTitleRunSpans', () => {
	it('returns undefined for a title with no typed runs', () => {
		expect(resolveChartTitleRunSpans(chart())).toBeUndefined();
		expect(resolveChartTitleRunSpans(undefined)).toBeUndefined();
	});

	it('resolves per-run bold/italic/size/colour, falling back to the title cascade for the rest', () => {
		const data = chart({
			titleRuns: [
				{ text: 'Sales ', bold: true },
				{ text: 'Q1', italic: true, fontSize: 20, color: '#FF0000' },
			],
			style: { hasTitle: true, titleFontFamily: 'Georgia' },
		});
		expect(resolveChartTitleRunSpans(data)).toStrictEqual([
			{ text: 'Sales ', fontSize: 12, fontWeight: 700, fill: '#1e293b', fontFamily: 'Georgia' },
			{
				text: 'Q1',
				fontSize: 20 * (4 / 3),
				fontWeight: 600,
				fontStyle: 'italic',
				fill: '#FF0000',
				fontFamily: 'Georgia',
			},
		]);
	});

	it('resolves a single-run title too, so a per-run override renders on its own', () => {
		const data = chart({ titleRuns: [{ text: 'Sales Q1', italic: true }] });
		const spans = resolveChartTitleRunSpans(data);
		expect(spans).toHaveLength(1);
		expect(spans![0]).toMatchObject({ text: 'Sales Q1', fontStyle: 'italic' });
	});
});

describe('collapseChartTitleRunsForEdit', () => {
	it('patches only the flat title when there are no runs yet', () => {
		expect(collapseChartTitleRunsForEdit(chart(), 'New Title')).toStrictEqual({
			title: 'New Title',
		});
	});

	it('patches only the flat title for a single-run title (core preserves that run in place)', () => {
		const data = chart({ titleRuns: [{ text: 'Sales Q1', bold: true }] });
		expect(collapseChartTitleRunsForEdit(data, 'New Title')).toStrictEqual({ title: 'New Title' });
	});

	it('collapses a multi-run title to one run in the dominant (longest) run style', () => {
		const data = chart({
			titleRuns: [
				{ text: 'Sales ', bold: true },
				{ text: 'Q1 Results', italic: true, color: '#FF0000' },
			],
		});
		expect(collapseChartTitleRunsForEdit(data, 'New Title')).toStrictEqual({
			title: 'New Title',
			titleRuns: [{ text: 'New Title', italic: true, color: '#FF0000' }],
		});
	});

	it('breaks a dominant-length tie by keeping the first run', () => {
		const data = chart({
			titleRuns: [
				{ text: 'AAA', bold: true },
				{ text: 'BBB', italic: true },
			],
		});
		expect(collapseChartTitleRunsForEdit(data, 'New')).toStrictEqual({
			title: 'New',
			titleRuns: [{ text: 'New', bold: true }],
		});
	});
});
