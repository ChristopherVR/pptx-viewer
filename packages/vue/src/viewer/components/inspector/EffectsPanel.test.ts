// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import EffectsPanel from './EffectsPanel.vue';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp 1',
		x: 100,
		y: 50,
		width: 200,
		height: 120,
		rotation: 0,
		opacity: 1,
		shapeStyle: {},
		...overrides,
	} as PptxElement;
}

function image(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'chart',
		id: 'ch 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		opacity: 1,
		...overrides,
	} as PptxElement;
}

function lastPatch(wrapper: ReturnType<typeof mount>): Partial<PptxElement> {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as Partial<PptxElement>;
}

function patchStyle(patch: Partial<PptxElement>): ShapeStyle {
	return (patch as { shapeStyle: ShapeStyle }).shapeStyle;
}

describe('effectsPanel', () => {
	it('emits a shallow opacity patch (0-100 slider to 0-1)', async () => {
		const wrapper = mount(EffectsPanel, { props: { element: shape() } });
		const range = wrapper.find('input[type="range"]');
		await range.setValue('50');
		expect(lastPatch(wrapper)).toStrictEqual({ opacity: 0.5 });
	});

	it('enables outer shadow with default flat shapeStyle fields', async () => {
		const wrapper = mount(EffectsPanel, { props: { element: shape() } });
		const toggle = wrapper.findAll('input[type="checkbox"]')[0];
		await toggle.setValue(true);
		const style = patchStyle(lastPatch(wrapper));
		expect(style.shadowColor).toBe('#000000');
		expect(style.shadowOpacity).toBe(0.4);
		expect(style.shadowBlur).toBe(6);
		expect(style.shadowAngle).toBe(315);
		expect(style.shadowDistance).toBe(5.66);
	});

	it('disables outer shadow by setting shadowColor transparent', async () => {
		const wrapper = mount(EffectsPanel, {
			props: { element: shape({ shapeStyle: { shadowColor: '#000000' } }) },
		});
		const toggle = wrapper.findAll('input[type="checkbox"]')[0];
		await toggle.setValue(false);
		expect(patchStyle(lastPatch(wrapper)).shadowColor).toBe('transparent');
	});

	it('merges shadow blur onto the current shapeStyle', async () => {
		const wrapper = mount(EffectsPanel, {
			props: { element: shape({ shapeStyle: { shadowColor: '#112233' } }) },
		});
		const blur = wrapper.findAll('input[type="number"]')[0];
		await blur.setValue('12');
		const style = patchStyle(lastPatch(wrapper));
		expect(style.shadowColor).toBe('#112233');
		expect(style.shadowBlur).toBe(12);
	});

	it('enables outer glow with default flat shapeStyle fields', async () => {
		const wrapper = mount(EffectsPanel, { props: { element: shape() } });
		const toggle = wrapper.findAll('input[type="checkbox"]')[1];
		await toggle.setValue(true);
		const style = patchStyle(lastPatch(wrapper));
		expect(style.glowColor).toBe('#ffff00');
		expect(style.glowOpacity).toBe(0.75);
		expect(style.glowRadius).toBe(6);
	});

	it('disables outer glow by zeroing radius and clearing color', async () => {
		const wrapper = mount(EffectsPanel, {
			props: { element: shape({ shapeStyle: { glowColor: '#ffff00', glowRadius: 6 } }) },
		});
		const toggle = wrapper.findAll('input[type="checkbox"]')[1];
		await toggle.setValue(false);
		const style = patchStyle(lastPatch(wrapper));
		expect(style.glowColor).toBe('transparent');
		expect(style.glowRadius).toBe(0);
	});

	it('shows a muted note for non-shape-like elements and hides effect toggles', () => {
		const wrapper = mount(EffectsPanel, { props: { element: image() } });
		expect(wrapper.find('.pptx-vue-effects-note').exists()).toBeTruthy();
		expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0);
	});
});
