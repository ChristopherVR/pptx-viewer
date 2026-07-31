import { mount } from '@vue/test-utils';
import { PX_PER_INCH, RULER_THICKNESS } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import RulerStrips from './RulerStrips.vue';
import SlideCanvas from './SlideCanvas.vue';

/**
 * RulerStrips tests: the View > Rulers strips must place their inch ticks at the
 * same slide positions React/Svelte do and re-place them when the stage zoom
 * changes (the strips live OUTSIDE the CSS-scaled stage, so they get no scaling
 * for free). Also covers the toggle and the drag-off-the-ruler guide gesture,
 * which used to be dead in Vue because the strips were `pointer-events: none`.
 */

const canvasSize = { width: 960, height: 540 };

/** Labelled tick positions on a strip, read back off the rendered SVG text. */
function labelPositions(strip: Element, axis: 'x' | 'y'): { label: string; at: number }[] {
	return [...strip.querySelectorAll('text')].map((node) => ({
		label: (node.textContent ?? '').trim(),
		at: Number(node.getAttribute(axis)),
	}));
}

describe('rulerStrips', () => {
	it('renders both strips under the neutral test contract', () => {
		const wrapper = mount(RulerStrips, { props: { canvasSize, scale: 1 } });
		expect(wrapper.find('[data-pptx-ruler="h"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-pptx-ruler="v"]').exists()).toBeTruthy();
		// Corner box (a positioned div) plus the two strips.
		expect(wrapper.find('div').exists()).toBeTruthy();
	});

	it('places a numbered tick every inch at 1x zoom', () => {
		const wrapper = mount(RulerStrips, { props: { canvasSize, scale: 1 } });
		const labels = labelPositions(wrapper.find('[data-pptx-ruler="h"]').element, 'x');
		expect(labels.map((entry) => entry.label)).toStrictEqual([
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
		// Labels sit 2px right of their tick, as React's ruler draws them.
		expect(labels[3]?.at).toBe(3 * PX_PER_INCH + 2);
	});

	it('halves the tick spacing at 0.5x zoom', () => {
		const wrapper = mount(RulerStrips, { props: { canvasSize, scale: 0.5 } });
		const labels = labelPositions(wrapper.find('[data-pptx-ruler="h"]').element, 'x');
		expect(labels[3]?.at).toBe(3 * PX_PER_INCH * 0.5 + 2);
		const vertical = labelPositions(wrapper.find('[data-pptx-ruler="v"]').element, 'y');
		// The vertical strip labels sit below their tick by the font size + 2.
		expect(vertical[2]?.at).toBe(2 * PX_PER_INCH * 0.5 + 12);
	});

	it('labels in centimetres when asked', () => {
		const wrapper = mount(RulerStrips, {
			props: { canvasSize, scale: 1, unit: 'centimetres' as const },
		});
		const labels = labelPositions(wrapper.find('[data-pptx-ruler="h"]').element, 'x');
		expect(labels.map((entry) => entry.label)).toContain('25');
	});

	it('highlights the selected element extent', () => {
		const wrapper = mount(RulerStrips, {
			props: { canvasSize, scale: 1, selectedBounds: { x: 100, y: 50, width: 200, height: 80 } },
		});
		const highlight = wrapper.find('[data-pptx-ruler="h"]').find('rect');
		expect(highlight.attributes('x')).toBe('100');
		expect(highlight.attributes('width')).toBe('200');
	});

	it('drops exactly one guide when a drag leaves the strip', async () => {
		const wrapper = mount(RulerStrips, { props: { canvasSize, scale: 1, draggable: true } });
		const strip = wrapper.find('[data-pptx-ruler="h"]');
		strip.element.getBoundingClientRect = () => new DOMRect(0, 0, 960, RULER_THICKNESS);

		await strip.trigger('pointerdown');
		await strip.trigger('pointerup', { clientY: RULER_THICKNESS + 120 });
		expect(wrapper.emitted('createGuide')).toStrictEqual([['h', 120]]);
	});

	it('ignores a drag that never left the strip', async () => {
		const wrapper = mount(RulerStrips, { props: { canvasSize, scale: 1, draggable: true } });
		const strip = wrapper.find('[data-pptx-ruler="h"]');
		strip.element.getBoundingClientRect = () => new DOMRect(0, 0, 960, RULER_THICKNESS);

		await strip.trigger('pointerdown');
		await strip.trigger('pointerup', { clientY: RULER_THICKNESS - 2 });
		expect(wrapper.emitted('createGuide')).toBeUndefined();
	});

	it('un-scales the drop position by the stage zoom', async () => {
		const wrapper = mount(RulerStrips, { props: { canvasSize, scale: 0.5, draggable: true } });
		const strip = wrapper.find('[data-pptx-ruler="v"]');
		strip.element.getBoundingClientRect = () => new DOMRect(0, 0, RULER_THICKNESS, 270);

		await strip.trigger('pointerdown');
		await strip.trigger('pointerup', { clientX: RULER_THICKNESS + 100 });
		expect(wrapper.emitted('createGuide')).toStrictEqual([['v', 200]]);
	});

	it('stays inert when guide dragging is not offered', async () => {
		const wrapper = mount(RulerStrips, { props: { canvasSize, scale: 1 } });
		const strip = wrapper.find('[data-pptx-ruler="h"]');
		strip.element.getBoundingClientRect = () => new DOMRect(0, 0, 960, RULER_THICKNESS);

		await strip.trigger('pointerdown');
		await strip.trigger('pointerup', { clientY: RULER_THICKNESS + 120 });
		expect(wrapper.emitted('createGuide')).toBeUndefined();
	});
});

describe('slideCanvas rulers toggle', () => {
	const canvasProps = {
		slide: undefined,
		canvasSize,
		mediaDataUrls: new Map<string, string>(),
		zoom: 1,
	};

	it('paints no ruler while the preference is off', () => {
		const wrapper = mount(SlideCanvas, { props: canvasProps });
		expect(wrapper.findAll('[data-pptx-ruler]')).toHaveLength(0);
	});

	it('paints both strips while the preference is on', () => {
		const wrapper = mount(SlideCanvas, { props: { ...canvasProps, showRulers: true } });
		expect(wrapper.findAll('[data-pptx-ruler]')).toHaveLength(2);
	});
});
