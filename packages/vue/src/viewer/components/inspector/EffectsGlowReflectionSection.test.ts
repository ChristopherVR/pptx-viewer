// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import EffectsGlowReflectionSection from './EffectsGlowReflectionSection.vue';

function shape(shapeStyle: ShapeStyle = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp 1',
		x: 0,
		y: 0,
		width: 200,
		height: 120,
		rotation: 0,
		opacity: 1,
		shapeStyle,
	} as PptxElement;
}

function lastPatch(wrapper: ReturnType<typeof mount>): { shapeStyle: ShapeStyle } {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as { shapeStyle: ShapeStyle };
}

describe('effectsGlowReflectionSection - glow', () => {
	it('enables outer glow with the shared default flat shapeStyle fields', async () => {
		const wrapper = mount(EffectsGlowReflectionSection, { props: { element: shape() } });
		await wrapper.find('[data-testid="fx-glow-toggle"]').setValue(true);
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.glowColor).toBe('#ffff00');
		expect(style.glowOpacity).toBe(0.75);
		expect(style.glowRadius).toBe(6);
	});

	it('disables outer glow by zeroing radius and clearing colour', async () => {
		const wrapper = mount(EffectsGlowReflectionSection, {
			props: { element: shape({ glowColor: '#ffff00', glowRadius: 6 }) },
		});
		await wrapper.find('[data-testid="fx-glow-toggle"]').setValue(false);
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.glowColor).toBe('transparent');
		expect(style.glowRadius).toBe(0);
	});
});

describe('effectsGlowReflectionSection - reflection', () => {
	it('enables reflection with the shared default flat shapeStyle fields', async () => {
		const wrapper = mount(EffectsGlowReflectionSection, { props: { element: shape() } });
		await wrapper.find('[data-testid="fx-reflection-toggle"]').setValue(true);
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.reflectionBlurRadius).toBe(3);
		expect(style.reflectionStartOpacity).toBe(50);
		expect(style.reflectionEndOpacity).toBe(0);
		expect(style.reflectionDirection).toBe(90);
	});

	it('disables reflection by zeroing every reflection field', async () => {
		const wrapper = mount(EffectsGlowReflectionSection, {
			props: { element: shape({ reflectionBlurRadius: 3, reflectionStartOpacity: 50 }) },
		});
		await wrapper.find('[data-testid="fx-reflection-toggle"]').setValue(false);
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.reflectionBlurRadius).toBe(0);
		expect(style.reflectionStartOpacity).toBe(0);
	});

	it('merges a reflection distance edit onto the current shapeStyle, preserving other reflection fields', async () => {
		const wrapper = mount(EffectsGlowReflectionSection, {
			props: {
				element: shape({
					reflectionBlurRadius: 3,
					reflectionStartOpacity: 60,
					reflectionDirection: 90,
				}),
			},
		});
		// Fields grid order: [blur, startOpacity, endOpacity, distance, direction].
		const numberInputs = wrapper.findAll('input[type="number"]');
		await numberInputs[3].setValue('12'); // distance
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.reflectionDistance).toBe(12);
		expect(style.reflectionStartOpacity).toBe(60);
	});
});

describe('effectsGlowReflectionSection - soft edge', () => {
	it('enables soft edge with a 6px default radius', async () => {
		const wrapper = mount(EffectsGlowReflectionSection, { props: { element: shape() } });
		await wrapper.find('[data-testid="fx-soft-edge-toggle"]').setValue(true);
		expect(lastPatch(wrapper).shapeStyle.softEdgeRadius).toBe(6);
	});

	it('disables soft edge by zeroing the radius', async () => {
		const wrapper = mount(EffectsGlowReflectionSection, {
			props: { element: shape({ softEdgeRadius: 10 }) },
		});
		await wrapper.find('[data-testid="fx-soft-edge-toggle"]').setValue(false);
		expect(lastPatch(wrapper).shapeStyle.softEdgeRadius).toBe(0);
	});

	it('updates the soft edge radius directly', async () => {
		const wrapper = mount(EffectsGlowReflectionSection, {
			props: { element: shape({ softEdgeRadius: 6 }) },
		});
		const radius = wrapper.find('input[type="number"]');
		await radius.setValue('24');
		expect(lastPatch(wrapper).shapeStyle.softEdgeRadius).toBe(24);
	});
});
