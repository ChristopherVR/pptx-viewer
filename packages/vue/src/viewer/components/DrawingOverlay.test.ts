import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DrawingOverlay from './DrawingOverlay.vue';

const base = { canvasSize: { width: 960, height: 540 }, color: '#ff0000', width: 2, scale: 1 };

interface StrokePayload {
	points: Array<{ x: number; y: number; pressure?: number }>;
	color: string;
	width: number;
	tool: string;
}

describe('drawingOverlay', () => {
	it('emits a stroke from a pen pointer down/move/up sequence', async () => {
		const wrapper = mount(DrawingOverlay, { props: { ...base, active: true, tool: 'pen' } });
		const svg = wrapper.get('svg');
		await svg.trigger('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 });
		await svg.trigger('pointermove', { clientX: 20, clientY: 15, pointerId: 1 });
		await svg.trigger('pointermove', { clientX: 30, clientY: 12, pointerId: 1 });
		await svg.trigger('pointerup', { clientX: 30, clientY: 12, pointerId: 1 });
		const stroke = wrapper.emitted('stroke')?.[0]?.[0] as StrokePayload | undefined;
		expect(stroke?.points.length).toBeGreaterThanOrEqual(3);
		expect(stroke?.color).toBe('#ff0000');
		expect(stroke?.tool).toBe('pen');
	});

	it('carries each pointer event pressure reading through to the emitted stroke points', async () => {
		// `onUp` commits whatever points pointerdown/pointermove already
		// accumulated (it does not sample the release event itself), so the
		// pressure trail comes from those two handlers.
		const wrapper = mount(DrawingOverlay, { props: { ...base, active: true, tool: 'pen' } });
		const svg = wrapper.get('svg');
		await svg.trigger('pointerdown', { clientX: 0, clientY: 0, pointerId: 1, pressure: 0.1 });
		await svg.trigger('pointermove', { clientX: 10, clientY: 0, pointerId: 1, pressure: 0.9 });
		await svg.trigger('pointermove', { clientX: 20, clientY: 0, pointerId: 1, pressure: 0.4 });
		await svg.trigger('pointerup', { clientX: 20, clientY: 0, pointerId: 1 });
		const stroke = wrapper.emitted('stroke')?.[0]?.[0] as StrokePayload | undefined;
		expect(stroke?.points.map((p) => p.pressure)).toStrictEqual([0.1, 0.9, 0.4]);
	});

	it('emits erase (not a stroke) for the eraser tool', async () => {
		const wrapper = mount(DrawingOverlay, { props: { ...base, active: true, tool: 'eraser' } });
		await wrapper.get('svg').trigger('pointerdown', { clientX: 40, clientY: 40, pointerId: 1 });
		expect(wrapper.emitted('erase')).toHaveLength(1);
		expect(wrapper.emitted('stroke')).toBeUndefined();
	});

	it('ignores pointer input when no tool is armed', async () => {
		const wrapper = mount(DrawingOverlay, { props: { ...base, active: false, tool: 'pen' } });
		await wrapper.get('svg').trigger('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 });
		await wrapper.get('svg').trigger('pointerup', { clientX: 10, clientY: 10, pointerId: 1 });
		expect(wrapper.emitted('stroke')).toBeUndefined();
	});
});
