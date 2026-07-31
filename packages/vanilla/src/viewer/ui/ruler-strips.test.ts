/**
 * Ruler-strip tests: Vanilla used to fake View > Rulers with a flat 18px border
 * on the stage wrap (no ticks, no labels, no guides), so its Rulers toggle was
 * purely cosmetic. The strips now render the SHARED `generateTicks` output and
 * resolve a drag off a strip with the SHARED `rulerDragToGuidePosition`, which
 * is what makes this binding agree with React, Vue, Angular and Svelte on tick
 * density, label text, units and the guide-drop rules.
 */
import { PX_PER_INCH, RULER_THICKNESS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import type { RulerStripsState } from './ruler-strips';
import { createRulerStrips } from './ruler-strips';

const CANVAS = { width: 960, height: 540 };

function state(overrides: Partial<RulerStripsState> = {}): RulerStripsState {
	return {
		visible: true,
		canvasSize: CANVAS,
		scale: 1,
		unit: 'inches',
		selection: null,
		draggable: false,
		...overrides,
	};
}

function mount(overrides: Partial<RulerStripsState> = {}, onCreateGuide = vi.fn()) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const strips = createRulerStrips(document, onCreateGuide);
	strips.mount(host);
	strips.update(state(overrides));
	return { host, strips, onCreateGuide };
}

/** Labelled tick positions on a strip, read back off the rendered SVG. */
function labels(host: HTMLElement, axis: 'h' | 'v'): { label: string; at: number }[] {
	const strip = host.querySelector(`[data-pptx-ruler="${axis}"]`);
	return [...(strip?.querySelectorAll('text') ?? [])].map((node) => ({
		label: node.textContent ?? '',
		at: Number(node.getAttribute(axis === 'h' ? 'x' : 'y')),
	}));
}

describe('rulerStrips rendering', () => {
	it('emits both strips under the neutral test contract', () => {
		const { host } = mount();
		const horizontal = host.querySelector('[data-pptx-ruler="h"]');
		const vertical = host.querySelector('[data-pptx-ruler="v"]');
		expect(horizontal?.getAttribute('width')).toBe(String(CANVAS.width));
		expect(horizontal?.getAttribute('height')).toBe(String(RULER_THICKNESS));
		expect(vertical?.getAttribute('width')).toBe(String(RULER_THICKNESS));
		expect(vertical?.getAttribute('height')).toBe(String(CANVAS.height));
		expect(host.querySelector('.pptxv-ruler-corner')).toBeTruthy();
	});

	it('places a numbered tick every inch at 1x zoom', () => {
		const { host } = mount();
		const found = labels(host, 'h');
		expect(found.map((entry) => entry.label)).toStrictEqual([
			'0',
			'1',
			'2',
			'3',
			'4',
			'5',
			'6',
			'7',
			'8',
			'9',
			'10',
		]);
		// Labels sit 2px past their tick, as React's ruler draws them.
		expect(found[3]?.at).toBe(3 * PX_PER_INCH + 2);
	});

	it('halves the tick spacing at 0.5x zoom', () => {
		const { host } = mount({ scale: 0.5 });
		expect(labels(host, 'h')[3]?.at).toBe(3 * PX_PER_INCH * 0.5 + 2);
		// The vertical strip labels sit below their tick by the font size + 2.
		expect(labels(host, 'v')[2]?.at).toBe(2 * PX_PER_INCH * 0.5 + 12);
	});

	it('labels in centimetres when the viewer is configured that way', () => {
		const { host } = mount({ unit: 'centimetres' });
		expect(labels(host, 'h').map((entry) => entry.label)).toContain('25');
	});

	it('shades the selected element extent on both strips', () => {
		const { host } = mount({ selection: { x: 100, y: 50, width: 200, height: 80 } });
		const highlight = host.querySelector('[data-pptx-ruler="h"] .pptxv-ruler-highlight');
		expect(highlight?.getAttribute('x')).toBe('100');
		expect(highlight?.getAttribute('width')).toBe('200');
	});

	it('hides both strips while the Rulers toggle is off, and shows them again', () => {
		const { host, strips } = mount({ visible: false });
		const horizontal = host.querySelector<SVGElement>('[data-pptx-ruler="h"]');
		expect(horizontal?.style.display).toBe('none');
		expect(host.querySelector('[data-pptx-ruler="h"] text')).toBeNull();

		strips.update(state({ visible: true }));
		expect(horizontal?.style.display).toBe('');
		expect(host.querySelectorAll('[data-pptx-ruler="h"] text').length).toBeGreaterThan(0);
	});
});

/* ------------------------------------------------------------------ */
/*  Drag off a strip -> exactly one guide                             */
/* ------------------------------------------------------------------ */

function drag(host: HTMLElement, axis: 'h' | 'v', offset: number): void {
	const strip = host.querySelector<SVGElement>(`[data-pptx-ruler="${axis}"]`);
	if (!strip) {
		throw new Error('strip missing');
	}
	strip.getBoundingClientRect = () =>
		({ top: 0, left: 0, width: 0, height: 0 }) as unknown as DOMRect;
	strip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
	strip.dispatchEvent(
		new PointerEvent('pointerup', {
			bubbles: true,
			clientX: axis === 'v' ? offset : 0,
			clientY: axis === 'h' ? offset : 0,
		}),
	);
}

describe('rulerStrips guide drag', () => {
	it('drops exactly one guide when the drag leaves the strip', () => {
		const { host, onCreateGuide } = mount({ draggable: true });
		drag(host, 'h', RULER_THICKNESS + 120);
		expect(onCreateGuide).toHaveBeenCalledExactlyOnceWith('h', 120);
	});

	it('ignores a click that never left the strip', () => {
		const { host, onCreateGuide } = mount({ draggable: true });
		drag(host, 'h', RULER_THICKNESS - 2);
		expect(onCreateGuide).not.toHaveBeenCalled();
	});

	it('un-scales the drop position by the stage zoom', () => {
		const { host, onCreateGuide } = mount({ draggable: true, scale: 0.5 });
		drag(host, 'v', RULER_THICKNESS + 100);
		expect(onCreateGuide).toHaveBeenCalledWith('v', 200);
	});

	it('discards a drop past the far edge of the slide', () => {
		const { host, onCreateGuide } = mount({ draggable: true });
		drag(host, 'h', RULER_THICKNESS + CANVAS.height + 20);
		expect(onCreateGuide).not.toHaveBeenCalled();
	});

	it('stays inert on a read-only canvas', () => {
		const { host, onCreateGuide } = mount({ draggable: false });
		drag(host, 'h', RULER_THICKNESS + 120);
		expect(onCreateGuide).not.toHaveBeenCalled();
	});
});

describe('rulerStrips stylesheet contract', () => {
	it('ships a rule for every class the strips emit', async () => {
		const { EDITOR_CSS } = await import('../styles/editor-css');
		for (const className of [
			'pptxv-ruler-corner',
			'pptxv-ruler-h',
			'pptxv-ruler-v',
			'pptxv-ruler-bg',
			'pptxv-ruler-edge',
			'pptxv-ruler-tick',
			'pptxv-ruler-highlight',
			'pptxv-ruler-label',
		]) {
			expect(EDITOR_CSS).toContain(`.${className}`);
		}
	});
});
