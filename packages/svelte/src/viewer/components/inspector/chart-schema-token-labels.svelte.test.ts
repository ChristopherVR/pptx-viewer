import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import {
	CHART_AXIS_TYPE_LABEL_KEYS,
	CHART_DATA_LABEL_POSITION_LABEL_KEYS,
	CHART_GRIDLINE_DASH_LABEL_KEYS,
	CHART_MARKER_SYMBOL_LABEL_KEYS,
	CHART_TYPE_LABEL_KEYS,
} from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ChartAdvancedSection from './ChartAdvancedSection.svelte';
import ChartLabelsAxesSection from './ChartLabelsAxesSection.svelte';
import ChartSection from './ChartSection.svelte';

/**
 * The chart panels used to print OOXML wire tokens (`doughnut`, `outEnd`,
 * `valAx`, `lgDash`) straight into their selects. These tests pin both halves
 * of the fix: the option TEXT is now the dictionary wording, and the option
 * VALUES are byte-identical to what the panel submitted before, so no control
 * gained or lost an entry.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** Only the label's own text nodes: its `<select>`'s option text is excluded. */
function ownText(element: Element): string {
	return Array.from(element.childNodes)
		.filter((node) => node.nodeType === Node.TEXT_NODE)
		.map((node) => node.textContent ?? '')
		.join('')
		.trim();
}

/** The `<select>` inside the `<label>` captioned `caption`. */
function selectFor(root: ParentNode, caption: string): HTMLSelectElement {
	for (const label of Array.from(root.querySelectorAll('label'))) {
		if (ownText(label) === caption) {
			const select = label.querySelector('select');
			if (select) {
				return select;
			}
		}
	}
	throw new Error(`no select captioned "${caption}"`);
}

function values(select: HTMLSelectElement): string[] {
	return Array.from(select.options).map((option) => option.value);
}

function texts(select: HTMLSelectElement): string[] {
	return Array.from(select.options).map((option) => option.textContent?.trim() ?? '');
}

/** English wording the shared table promises for each token. */
function expected(keys: Readonly<Record<string, string>>, tokens: readonly string[]): string[] {
	return tokens.map((token) => translationsEn[keys[token]]);
}

function mountAt<Props extends Record<string, unknown>>(
	component: Parameters<typeof mount>[0],
	props: Props,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component, { target, props });
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	flushSync();
	return target;
}

function chartData(): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'Revenue', values: [1, 2], marker: { symbol: 'circle' } }],
		style: { hasDataLabels: true },
		axes: [{ axisType: 'valAx', majorGridlines: true }, { axisType: 'catAx' }],
	};
}

function chartEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	const element: PptxElement = {
		type: 'chart',
		id: 'c1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: chartData(),
	};
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }]);
	editor.select('c1');
	return editor;
}

describe('chartSection chart-type select', () => {
	const tokens = [
		'bar',
		'line',
		'pie',
		'doughnut',
		'area',
		'scatter',
		'bubble',
		'radar',
		'stock',
		'waterfall',
		'histogram',
		'pareto',
		'funnel',
		'treemap',
		'sunburst',
		'boxWhisker',
		'regionMap',
		'combo',
	];

	it('spells every chart type instead of printing the wire token', () => {
		const target = mountAt(ChartSection, { editor: chartEditor() });
		const select = selectFor(target, 'Chart type');

		expect(values(select)).toStrictEqual(tokens);
		expect(texts(select)).toStrictEqual(expected(CHART_TYPE_LABEL_KEYS, tokens));
		// The defect shape itself: an option whose text is its own wire value.
		expect(texts(select).filter((text, index) => text === tokens[index])).toStrictEqual([]);
	});
});

describe('chartAdvancedSection token selects', () => {
	const seriesTypes = ['bar', 'line', 'area', 'scatter'];
	const markers = [
		'auto',
		'circle',
		'diamond',
		'square',
		'star',
		'triangle',
		'plus',
		'x',
		'dash',
		'dot',
	];

	it('labels the per-series chart type and marker symbol', () => {
		const target = mountAt(ChartAdvancedSection, { data: chartData(), onpatch: () => undefined });

		const type = selectFor(target, 'Series chart type');
		// The leading '' option ("Chart default") is part of the value set and
		// must survive untouched.
		expect(values(type)).toStrictEqual(['', ...seriesTypes]);
		expect(texts(type)).toStrictEqual([
			'Chart default',
			...expected(CHART_TYPE_LABEL_KEYS, seriesTypes),
		]);

		const marker = selectFor(target, 'Marker');
		expect(values(marker)).toStrictEqual(['', ...markers]);
		expect(texts(marker)).toStrictEqual([
			'None',
			...expected(CHART_MARKER_SYMBOL_LABEL_KEYS, markers),
		]);
	});
});

describe('chartLabelsAxesSection token selects', () => {
	const positions = ['bestFit', 'b', 'ctr', 'inBase', 'inEnd', 'l', 'outEnd', 'r', 't'];
	const dashes = ['solid', 'dash', 'dot', 'lgDash'];

	it('labels the data-label position without changing its values', () => {
		const target = mountAt(ChartLabelsAxesSection, {
			data: chartData(),
			onpatch: () => undefined,
		});
		const select = selectFor(target, 'Position');

		expect(values(select)).toStrictEqual(['', ...positions]);
		expect(texts(select)).toStrictEqual([
			'Automatic',
			...expected(CHART_DATA_LABEL_POSITION_LABEL_KEYS, positions),
		]);
	});

	it('names each axis fieldset instead of showing valAx / catAx', () => {
		const target = mountAt(ChartLabelsAxesSection, {
			data: chartData(),
			onpatch: () => undefined,
		});
		const legends = Array.from(target.querySelectorAll('legend')).map((legend) =>
			legend.textContent?.trim(),
		);

		expect(legends).toStrictEqual(expected(CHART_AXIS_TYPE_LABEL_KEYS, ['valAx', 'catAx']));
	});

	it('keeps the gridline dash values now that the option text is translated', () => {
		const target = mountAt(ChartLabelsAxesSection, {
			data: chartData(),
			onpatch: () => undefined,
		});
		const select = selectFor(target, 'Grid dash');

		// These options carried no `value` attribute before, so their TEXT was
		// the submitted value. Translating the text without adding `value` would
		// have written "Solid" into a:prstDash.
		expect(values(select)).toStrictEqual(dashes);
		expect(texts(select)).toStrictEqual(expected(CHART_GRIDLINE_DASH_LABEL_KEYS, dashes));
	});

	it('still writes the wire token when a dash is picked', () => {
		let patched: Partial<PptxChartData> | undefined;
		const target = mountAt(ChartLabelsAxesSection, {
			data: chartData(),
			onpatch: (patch: Partial<PptxChartData>) => {
				patched = patch;
			},
		});
		const select = selectFor(target, 'Grid dash');
		select.value = 'lgDash';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(patched?.axes?.[0]?.majorGridlinesSpPr?.strokeDashStyle).toBe('lgDash');
	});
});
