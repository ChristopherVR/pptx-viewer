/**
 * The label helpers every binding shares must speak the viewer's language.
 *
 * Each of these used to hand back English built into the module: the
 * accessibility checker's severity headings and issue types, the theme colour
 * grid's row and slot captions, the chart placeholder's caption, and the
 * Summary Zoom tile subtitles. Five bindings rendered that English straight
 * into the DOM, one of them (Vue) alongside a private copy of the very key maps
 * that now live here.
 *
 * The suite pins both halves of the contract: the translated path resolves the
 * documented `pptx.*` keys, and the no-translator path still returns the
 * English fallback, which is what keeps the change from breaking a host that
 * calls these helpers directly.
 */
import type { AccessibilityIssue, PptxThemeColorScheme, ZoomPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	groupIssuesBySeverity,
	issueTypeLabel,
	SEVERITY_LABEL_KEYS,
	TYPE_LABEL_KEYS,
} from './accessibility-issues';
import { chartPlaceholderLabel } from './chart-schema-label-keys';
import { buildSummaryZoomView } from './summary-zoom';
import { buildThemeColorGrid, themeColorLabel } from './text-theme';

/** Echoes the key (plus any params) so a spec can see exactly what was asked for. */
function echo(key: string, params?: Record<string, string>): string {
	const entries = Object.entries(params ?? {});
	if (entries.length === 0) {
		return key;
	}
	const rendered = entries.map(([name, value]) => `${name}=${value}`).join(',');
	return `${key}(${rendered})`;
}

function issue(overrides: Partial<AccessibilityIssue> = {}): AccessibilityIssue {
	return {
		slideIndex: 0,
		severity: 'error',
		type: 'missingAltText',
		message: 'An image has no alt text',
		...overrides,
	} as AccessibilityIssue;
}

const colors: PptxThemeColorScheme = {
	dk1: '#000000',
	lt1: '#ffffff',
	dk2: '#44546a',
	lt2: '#e7e6e6',
	accent1: '#4472c4',
	accent2: '#ed7d31',
	accent3: '#a5a5a5',
	accent4: '#ffc000',
	accent5: '#5b9bd5',
	accent6: '#70ad47',
	hlink: '#0563c1',
	folHlink: '#954f72',
};

describe('accessibility labels', () => {
	it('resolves severity headings through the shared key map', () => {
		const groups = groupIssuesBySeverity([issue()], echo);

		expect(groups).toHaveLength(1);
		expect(groups[0]?.label).toBe(SEVERITY_LABEL_KEYS.error);
	});

	it('resolves issue types through the shared key map', () => {
		expect(issueTypeLabel('lowContrast', echo)).toBe(TYPE_LABEL_KEYS.lowContrast);
	});

	it('still returns English when no translator is supplied', () => {
		expect(groupIssuesBySeverity([issue()])[0]?.label).toBe('Errors');
		expect(issueTypeLabel('lowContrast')).toBe('Low contrast');
	});

	it('keeps the display order (errors, then warnings, then tips)', () => {
		const groups = groupIssuesBySeverity(
			[issue({ severity: 'tip' }), issue({ severity: 'error' }), issue({ severity: 'warning' })],
			echo,
		);

		expect(groups.map((group) => group.severity)).toStrictEqual(['error', 'warning', 'tip']);
	});
});

describe('theme colour labels', () => {
	it('labels the grid rows and columns through the shared keys', () => {
		const grid = buildThemeColorGrid(colors, echo);

		expect(grid[0]?.[0]?.rowLabel).toBe('pptx.themeColor.tintBase');
		expect(grid[0]?.[0]?.colLabel).toBe('pptx.themeColor.dark1');
		expect(grid[4]?.[0]?.rowLabel).toBe('pptx.themeColor.tintDarker25');
	});

	it('falls back to English with no translator', () => {
		const grid = buildThemeColorGrid(colors);

		expect(grid[0]?.[0]?.rowLabel).toBe('Base');
		expect(grid[0]?.[0]?.colLabel).toBe('Dark 1');
		expect(themeColorLabel('folHlink')).toBe('Followed Hyperlink');
	});

	it('still computes the same 12x6 tint grid', () => {
		const grid = buildThemeColorGrid(colors, echo);

		expect(grid).toHaveLength(6);
		expect(grid[0]).toHaveLength(12);
		expect(grid[0]?.[4]?.hex.toLowerCase()).toBe('#4472c4');
	});
});

describe('chart placeholder caption', () => {
	it('spells the chart kind through its own key rather than the wire token', () => {
		expect(chartPlaceholderLabel('ofPie', echo)).toBe(
			'pptx.chart.placeholderLabel(type=pptx.chart.typeOfPie)',
		);
	});

	it('shows an unmapped kind rather than blanking the tile', () => {
		expect(chartPlaceholderLabel('somethingNewerThanThisTable', echo)).toBe(
			'pptx.chart.placeholderLabel(type=somethingNewerThanThisTable)',
		);
	});

	it('treats a missing chart type as unknown', () => {
		expect(chartPlaceholderLabel(undefined, echo)).toBe(
			'pptx.chart.placeholderLabel(type=pptx.chart.typeUnknown)',
		);
	});
});

describe('summary zoom captions', () => {
	const summary: ZoomPptxElement = {
		id: 'summary',
		type: 'zoom',
		zoomType: 'summary',
		targetSlideIndex: 1,
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		summaryLayout: 'grid',
		summaryTargets: [
			{ sectionId: 'intro', targetSlideIndex: 1, x: 0, y: 0, width: 200, height: 200 },
		],
	} as ZoomPptxElement;

	it('translates the tile subtitle and both aria-labels', () => {
		const view = buildSummaryZoomView(summary, undefined, echo);

		expect(view?.ariaLabel).toBe('pptx.zoom.ariaLabelSummary(count=1)');
		expect(view?.tiles[0]?.slideLabel).toBe('pptx.zoom.slideNumber(number=2)');
		expect(view?.tiles[0]?.ariaLabel).toBe(
			'pptx.zoom.ariaLabelSummaryTile(section=intro,number=2)',
		);
	});

	it('falls back to English with no translator', () => {
		const view = buildSummaryZoomView(summary);

		expect(view?.ariaLabel).toBe('Summary Zoom with 1 sections');
		expect(view?.tiles[0]?.slideLabel).toBe('Slide 2');
	});
});
