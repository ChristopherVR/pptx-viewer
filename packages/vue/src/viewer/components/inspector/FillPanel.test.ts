// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import FillPanel from './FillPanel.vue';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle: { fillMode: 'solid', fillColor: '#00aa55', fillOpacity: 1 },
		...overrides,
	} as PptxElement;
}

function media(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'media',
		id: 'md 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

function lastPatch(wrapper: ReturnType<typeof mount>): Partial<PptxElement> {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as Partial<PptxElement>;
}

describe('fillPanel', () => {
	it('shows the muted note for non-shape elements', () => {
		const wrapper = mount(FillPanel, { props: { element: media() } });
		expect(wrapper.text()).toContain('No fill options');
		expect(wrapper.find('select').exists()).toBeFalsy();
	});

	it('emits the full merged shapeStyle when fill mode changes', async () => {
		const wrapper = mount(FillPanel, { props: { element: shape() } });
		const select = wrapper.find('select');
		await select.setValue('none');
		expect(lastPatch(wrapper)).toStrictEqual({
			shapeStyle: { fillMode: 'none', fillColor: '#00aa55', fillOpacity: 1 },
		});
	});

	it('emits the full merged shapeStyle when color changes', async () => {
		const wrapper = mount(FillPanel, { props: { element: shape() } });
		const color = wrapper.find('input[type="color"]');
		await color.setValue('#123456');
		expect(lastPatch(wrapper)).toStrictEqual({
			shapeStyle: { fillMode: 'solid', fillColor: '#123456', fillOpacity: 1 },
		});
	});

	it('stores opacity as a 0-1 fraction from the 0-100 slider', async () => {
		const wrapper = mount(FillPanel, { props: { element: shape() } });
		const range = wrapper.find('input[type="range"]');
		await range.setValue('40');
		expect(lastPatch(wrapper)).toStrictEqual({
			shapeStyle: { fillMode: 'solid', fillColor: '#00aa55', fillOpacity: 0.4 },
		});
	});

	it('the select offers a pattern option alongside none/solid/gradient', () => {
		const wrapper = mount(FillPanel, { props: { element: shape() } });
		const values = wrapper.findAll('option').map((o) => o.attributes('value'));
		expect(values).toStrictEqual(['none', 'solid', 'gradient', 'pattern']);
	});

	it('an element already in gradient mode renders FillGradientControls (stop rows), not the solid swatch', () => {
		const wrapper = mount(FillPanel, {
			props: { element: shape({ shapeStyle: { fillMode: 'gradient' } }) },
		});
		expect(wrapper.find('.pptx-vue-fill-color').exists()).toBeFalsy();
		expect(wrapper.findAll('[data-testid="fx-gradient-stop-row"]').length).toBeGreaterThan(0);
	});

	it('an element already in pattern mode renders FillPatternControls (preset swatch grid)', () => {
		const wrapper = mount(FillPanel, {
			props: { element: shape({ shapeStyle: { fillMode: 'pattern' } }) },
		});
		expect(wrapper.findAll('[data-testid="fx-pattern-swatch"]').length).toBeGreaterThan(0);
	});

	it('forwards a gradient-section patch through to the update event untouched', async () => {
		const wrapper = mount(FillPanel, {
			props: { element: shape({ shapeStyle: { fillMode: 'gradient' } }) },
		});
		await wrapper.find('.pptx-vue-gradient-add').trigger('click');
		const patch = lastPatch(wrapper) as { shapeStyle: { fillGradientStops?: unknown[] } };
		expect(patch.shapeStyle.fillGradientStops).toHaveLength(3);
	});

	it('forwards a pattern-section patch through to the update event untouched', async () => {
		const wrapper = mount(FillPanel, {
			props: { element: shape({ shapeStyle: { fillMode: 'pattern' } }) },
		});
		await wrapper.find('[data-testid="fx-pattern-swatch"]').trigger('click');
		const patch = lastPatch(wrapper) as { shapeStyle: { fillPatternPreset?: string } };
		expect(patch.shapeStyle.fillPatternPreset).toBeDefined();
	});

	it('pushes a committed fill colour onto the injected recent-colours list and offers it back', async () => {
		const recent = ref<string[]>(['#112233']);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mount(FillPanel, {
			props: { element: shape() },
			global: { provide: { [RecentColorsKey as symbol]: { recent, push } } },
		});

		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeTruthy();

		const color = wrapper.find('input[type="color"]');
		await color.setValue('#00ff00');
		expect(recent.value[0]).toBe('#00ff00');
	});
});
