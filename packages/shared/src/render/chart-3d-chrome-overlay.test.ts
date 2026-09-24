import { describe, expect, it } from 'vitest';

import { renderChart3DChromeOverlaySvg } from './chart-3d-chrome-overlay';
import type { ChartViewModel } from './chart-view-model-types';

/** Minimal fake SVG DOM, just enough for chart-view-model-dom.ts's piece renderers. */
interface FakeEl {
	tag: string;
	attrs: Record<string, string>;
	style: Record<string, string>;
	children: FakeEl[];
	textContent: string;
	setAttribute(name: string, value: string): void;
	appendChild(child: FakeEl): FakeEl;
}

function fakeEl(tag: string): FakeEl {
	const el: FakeEl = {
		tag,
		attrs: {},
		style: {},
		children: [],
		textContent: '',
		setAttribute(name, value) {
			el.attrs[name] = value;
		},
		appendChild(child) {
			el.children.push(child);
			return child;
		},
	};
	// `style.setProperty` used directly by this module.
	(el.style as unknown as { setProperty: (n: string, v: string) => void }).setProperty = (n, v) => {
		el.style[n] = v;
	};
	return el;
}

function fakeDoc(): Document {
	return { createElementNS: (_ns: string, tag: string) => fakeEl(tag) } as unknown as Document;
}

function baseVm(overrides: Partial<ChartViewModel> = {}): ChartViewModel {
	return {
		svgWidth: 400,
		svgHeight: 300,
		title: 'Chart Title',
		titleX: 200,
		titleY: 14,
		gridlines: [{ kind: 'line', x1: 0, y1: 50, x2: 400, y2: 50, stroke: '#eee', strokeWidth: 1 }],
		axisLabels: [
			{ kind: 'text', x: 5, y: 50, textAnchor: 'start', fontSize: 9, fill: '#666', text: '5' },
		],
		zeroLine: { kind: 'line', x1: 0, y1: 280, x2: 400, y2: 280, stroke: '#333', strokeWidth: 1 },
		categoryLabels: [
			{ kind: 'text', x: 100, y: 290, textAnchor: 'middle', fontSize: 9, fill: '#666', text: 'Q1' },
		],
		primitives: [{ kind: 'rect', x: 10, y: 20, w: 30, h: 40, fill: '#156082' }],
		dataLabels: [
			{ kind: 'text', x: 10, y: 10, textAnchor: 'middle', fontSize: 9, fill: '#000', text: '5' },
		],
		legend: [{ color: '#156082', label: 'Series 1' }],
		legendX: 200,
		legendY: 295,
		legendAnchor: 'middle',
		areaFill: '#ffffff',
		...overrides,
	};
}

describe('renderChart3DChromeOverlaySvg', () => {
	it('sizes the svg viewBox to the view-model and stretches non-uniformly', () => {
		const svg = renderChart3DChromeOverlaySvg(fakeDoc(), baseVm()) as unknown as FakeEl;
		expect(svg.attrs.viewBox).toBe('0 0 400 300');
		expect(svg.attrs.preserveAspectRatio).toBe('none');
	});

	it('is pointer-events:none so clicks fall through to the WebGL canvas underneath', () => {
		const svg = renderChart3DChromeOverlaySvg(fakeDoc(), baseVm()) as unknown as FakeEl;
		expect(svg.style['pointer-events']).toBe('none');
	});

	it('draws area fill, title, gridlines, axis/category labels, zero line and legend', () => {
		const svg = renderChart3DChromeOverlaySvg(fakeDoc(), baseVm()) as unknown as FakeEl;
		const tags = svg.children.map((c) => c.tag);
		expect(tags).toContain('rect'); // area fill
		expect(tags.filter((t) => t === 'text').length).toBeGreaterThanOrEqual(3); // title + axis + category
		expect(tags).toContain('line'); // gridline + zero line
		expect(tags).toContain('g'); // legend item group
	});

	it('omits the data marks (primitives/dataLabels): those come from real WebGL geometry now', () => {
		const svg = renderChart3DChromeOverlaySvg(fakeDoc(), baseVm()) as unknown as FakeEl;
		// Only the area-fill rect and the legend's own colour-swatch rect
		// should appear; the primitive bar rect (fill #156082) must not.
		const rectFills = svg.children.filter((c) => c.tag === 'rect').map((c) => c.attrs.fill);
		expect(rectFills).not.toContain('#156082');
		expect(rectFills).toContain('#ffffff'); // area fill
	});

	it('skips the area-fill rect when the chart declares a:noFill', () => {
		const svg = renderChart3DChromeOverlaySvg(
			fakeDoc(),
			baseVm({ areaFill: undefined }),
		) as unknown as FakeEl;
		expect(svg.children.some((c) => c.tag === 'rect')).toBeFalsy();
	});
});
