// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import FillGradientControls from './FillGradientControls.vue';

function shape(shapeStyle: ShapeStyle = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle,
	} as PptxElement;
}

function lastPatch(wrapper: ReturnType<typeof mount>): { shapeStyle: ShapeStyle } {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as { shapeStyle: ShapeStyle };
}

describe('fillGradientControls', () => {
	it('starts from the shared default two-stop gradient when none is configured', () => {
		const wrapper = mount(FillGradientControls, { props: { element: shape() } });
		expect(wrapper.findAll('[data-testid="fx-gradient-stop-row"]')).toHaveLength(2);
	});

	it('switches gradient type and activates fillMode: gradient', async () => {
		const wrapper = mount(FillGradientControls, {
			props: { element: shape({ fillMode: 'gradient', fillGradientType: 'linear' }) },
		});
		const select = wrapper.find('select');
		await select.setValue('radial');
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.fillMode).toBe('gradient');
		expect(style.fillGradientType).toBe('radial');
	});

	it('hides the angle control for a radial gradient', () => {
		const wrapper = mount(FillGradientControls, {
			props: { element: shape({ fillGradientType: 'radial' }) },
		});
		expect(wrapper.find('input[type="range"]').exists()).toBeFalsy();
	});

	it('updates a stop color, preserving its position', async () => {
		const wrapper = mount(FillGradientControls, {
			props: {
				element: shape({
					fillGradientStops: [
						{ color: '#ff0000', position: 0 },
						{ color: '#0000ff', position: 100 },
					],
				}),
			},
		});
		const firstColor = wrapper.find('input[type="color"]');
		await firstColor.setValue('#00ff00');
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.fillGradientStops?.[0]).toMatchObject({ color: '#00ff00', position: 0 });
		expect(style.fillGradientStops?.[1]).toMatchObject({ color: '#0000ff', position: 100 });
	});

	it('adds a stop via addGradientStopPatch', async () => {
		const wrapper = mount(FillGradientControls, { props: { element: shape() } });
		await wrapper.find('.pptx-vue-gradient-add').trigger('click');
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.fillGradientStops).toHaveLength(3);
	});

	it('removes a stop, but never below two remaining', async () => {
		const wrapper = mount(FillGradientControls, {
			props: {
				element: shape({
					fillGradientStops: [
						{ color: '#ff0000', position: 0 },
						{ color: '#00ff00', position: 50 },
						{ color: '#0000ff', position: 100 },
					],
				}),
			},
		});
		const removeButtons = wrapper.findAll('.pptx-vue-gradient-remove');
		expect(removeButtons).toHaveLength(3);
		await removeButtons[1].trigger('click');
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.fillGradientStops).toHaveLength(2);
	});
});
