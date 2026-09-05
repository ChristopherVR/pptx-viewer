// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { ThemeColorMapKey } from '../../composables/theme-color-map-context';
import FillGradientControls from './FillGradientControls.vue';

const OFFICE_THEME = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#44546A',
	lt2: '#E7E6E6',
	accent1: '#4472C4',
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	bg1: '#FFFFFF',
	tx1: '#000000',
	bg2: '#E7E6E6',
	tx2: '#44546A',
};

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

describe('fillGradientControls theme colour picker', () => {
	it('commits both the resolved hex and the ref on a theme swatch click', async () => {
		const wrapper = mount(FillGradientControls, {
			props: {
				element: shape({
					fillGradientStops: [
						{ color: '#ff0000', position: 0 },
						{ color: '#0000ff', position: 100 },
					],
				}),
			},
			global: { provide: { [ThemeColorMapKey as symbol]: ref(OFFICE_THEME) } },
		});
		const accent1 = wrapper.get('button[title="Accent 1"]');
		await accent1.trigger('click');
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.fillGradientStops?.[0]).toMatchObject({
			color: '#4472c4',
			colorRef: { scheme: 'accent1' },
		});
	});

	it('clears a previously-stored ref when the native colour input changes', async () => {
		const wrapper = mount(FillGradientControls, {
			props: {
				element: shape({
					fillGradientStops: [
						{ color: '#4472c4', position: 0, colorRef: { scheme: 'accent1' } },
						{ color: '#0000ff', position: 100 },
					],
				}),
			},
			global: { provide: { [ThemeColorMapKey as symbol]: ref(OFFICE_THEME) } },
		});
		const firstColor = wrapper.find('input[type="color"]');
		await firstColor.setValue('#00ff00');
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.fillGradientStops?.[0]?.colorRef).toBeFalsy();
	});
});
