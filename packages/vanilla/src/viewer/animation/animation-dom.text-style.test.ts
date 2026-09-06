import type { ElementAnimationState } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { registerChart3DTextStyleHandle } from '../render/elements/chart-3d-text-style-registry';
import { applyElementAnimationStyles } from './animation-dom';

function stage(): HTMLElement {
	const root = document.createElement('div');
	const el = document.createElement('div');
	el.dataset.elementId = 'sp_1';
	root.appendChild(el);
	document.body.appendChild(root);
	return root;
}

describe('applyElementAnimationStyles text-style override', () => {
	it('adds a scoped !important override style tag while bold is active', () => {
		const root = stage();
		const states = new Map<string, ElementAnimationState>([
			['sp_1', { visible: true, cssAnimation: undefined, textStyle: { bold: true } }],
		]);
		applyElementAnimationStyles(root, states, new Set(), new Set());

		const el = root.querySelector<HTMLElement>('[data-element-id="sp_1"]');
		const styleTag = el?.querySelector('style[data-pptx-text-style-override]');
		expect(styleTag?.textContent).toContain('[data-element-id="sp_1"] [style]');
		expect(styleTag?.textContent).toContain('font-weight: bold !important');
	});

	it('removes the override style tag once the effect ends', () => {
		const root = stage();
		const withStyle = new Map<string, ElementAnimationState>([
			['sp_1', { visible: true, cssAnimation: undefined, textStyle: { bold: true } }],
		]);
		applyElementAnimationStyles(root, withStyle, new Set(), new Set());
		expect(root.querySelector('style[data-pptx-text-style-override]')).not.toBeNull();

		const withoutStyle = new Map<string, ElementAnimationState>([
			['sp_1', { visible: true, cssAnimation: undefined }],
		]);
		applyElementAnimationStyles(root, withoutStyle, new Set(), new Set());
		expect(root.querySelector('style[data-pptx-text-style-override]')).toBeNull();
	});

	it('adds no override style tag when no font-style emphasis is active', () => {
		const root = stage();
		const states = new Map<string, ElementAnimationState>([
			['sp_1', { visible: true, cssAnimation: undefined }],
		]);
		applyElementAnimationStyles(root, states, new Set(), new Set());
		expect(root.querySelector('style[data-pptx-text-style-override]')).toBeNull();
	});

	// PowerPoint animates a table cell, a chart title/label/legend, a SmartArt
	// node caption and a connector caption the same way it animates plain text.
	// `applyElementAnimationStyles` walks every `[data-element-id]` node with no
	// type check at all, so this is already correct for every element type; these
	// regression tests pin that down against a table-cell-shaped and a chart-SVG-
	// shaped subtree, matching how the vanilla element renderers actually mark up
	// those types (see `render/elements/table.ts` / `chart-svg.ts`).

	function tableStage(): HTMLElement {
		const root = document.createElement('div');
		const table = document.createElement('div');
		table.dataset.elementId = 'table-1';
		const cell = document.createElement('td');
		cell.setAttribute('style', 'color: #000000');
		cell.textContent = 'Evidence cell';
		table.appendChild(cell);
		root.appendChild(table);
		document.body.appendChild(root);
		return root;
	}

	it('reaches a table cell (a plain HTML element with its own inline style)', () => {
		const root = tableStage();
		const states = new Map<string, ElementAnimationState>([
			['table-1', { visible: true, cssAnimation: undefined, textStyle: { bold: true } }],
		]);
		applyElementAnimationStyles(root, states, new Set(), new Set());

		const wrapper = root.querySelector<HTMLElement>('[data-element-id="table-1"]');
		const styleTag = wrapper?.querySelector('style[data-pptx-text-style-override]');
		expect(styleTag?.textContent).toContain('[data-element-id="table-1"] [style]');
		expect(styleTag?.textContent).toContain('font-weight: bold !important');
	});

	function chartStage(): HTMLElement {
		const root = document.createElement('div');
		const chart = document.createElement('div');
		chart.dataset.elementId = 'chart-1';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		text.setAttribute('fill', '#1e293b');
		text.textContent = 'Sales';
		svg.appendChild(text);
		chart.appendChild(svg);
		root.appendChild(chart);
		document.body.appendChild(root);
		return root;
	}

	it('reaches chart SVG text via the fill-targeted text/tspan rule (no [style] attribute)', () => {
		const root = chartStage();
		const states = new Map<string, ElementAnimationState>([
			['chart-1', { visible: true, cssAnimation: undefined, textStyle: { color: '#ff0000' } }],
		]);
		applyElementAnimationStyles(root, states, new Set(), new Set());

		const wrapper = root.querySelector<HTMLElement>('[data-element-id="chart-1"]');
		const styleTag = wrapper?.querySelector('style[data-pptx-text-style-override]');
		expect(styleTag?.textContent).toContain('color: #ff0000 !important');
		expect(styleTag?.textContent).toContain(
			'[data-element-id="chart-1"] text, [data-element-id="chart-1"] tspan { fill: #ff0000 !important; }',
		);
	});

	// A 3D chart/SmartArt3D element's axis labels / node captions are
	// canvas-drawn textures, so the CSS override above can never reach them.
	// `chart-3d-text-style-registry.ts` is the robust path: the 3D renderer
	// registers its mounted handle, and this per-tick pass forwards the SAME
	// descriptor straight to `handle.setTextStyle`, alongside the (here
	// ineffective, but harmless) CSS override.
	it('forwards the active text style to a registered 3D scene handle', () => {
		const root = stage();
		const setTextStyle = vi.fn();
		registerChart3DTextStyleHandle(document, 'sp_1', { setTextStyle });

		const states = new Map<string, ElementAnimationState>([
			['sp_1', { visible: true, cssAnimation: undefined, textStyle: { bold: true } }],
		]);
		applyElementAnimationStyles(root, states, new Set(), new Set());

		expect(setTextStyle).toHaveBeenCalledExactlyOnceWith({ bold: true });
	});
});
