// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import EffectsShadowSection from './EffectsShadowSection.vue';

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

describe('effectsShadowSection - outer shadow', () => {
	it('enables outer shadow with the shared default flat shapeStyle fields, including rotateWithShape', async () => {
		const wrapper = mount(EffectsShadowSection, { props: { element: shape() } });
		await wrapper.find('[data-testid="fx-outer-shadow-toggle"]').setValue(true);
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.shadowColor).toBe('#000000');
		expect(style.shadowOpacity).toBe(0.35);
		expect(style.shadowBlur).toBe(6);
		expect(style.shadowAngle).toBe(315);
		expect(style.shadowDistance).toBeCloseTo(5.66, 2);
		expect(style.shadowRotateWithShape).toBeTruthy();
	});

	it('disables outer shadow by setting shadowColor transparent', async () => {
		const wrapper = mount(EffectsShadowSection, {
			props: { element: shape({ shadowColor: '#000000' }) },
		});
		await wrapper.find('[data-testid="fx-outer-shadow-toggle"]').setValue(false);
		expect(lastPatch(wrapper).shapeStyle.shadowColor).toBe('transparent');
	});

	it('merges a shadow blur edit onto the current shapeStyle', async () => {
		const wrapper = mount(EffectsShadowSection, {
			props: { element: shape({ shadowColor: '#112233' }) },
		});
		const blur = wrapper.findAll('input[type="number"]')[0];
		await blur.setValue('12');
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.shadowColor).toBe('#112233');
		expect(style.shadowBlur).toBe(12);
	});

	it('toggles shadowRotateWithShape independently of the other shadow fields', async () => {
		const wrapper = mount(EffectsShadowSection, {
			props: {
				element: shape({
					shadowColor: '#112233',
					shadowRotateWithShape: true,
					shadowBlur: 8,
				}),
			},
		});
		await wrapper.find('[data-testid="fx-outer-shadow-rotate-with-shape"]').setValue(false);
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.shadowRotateWithShape).toBeFalsy();
		expect(style.shadowColor).toBe('#112233');
		expect(style.shadowBlur).toBe(8);
	});
});

describe('effectsShadowSection - inner shadow', () => {
	it('enables inner shadow with the shared default flat shapeStyle fields', async () => {
		const wrapper = mount(EffectsShadowSection, { props: { element: shape() } });
		await wrapper.find('[data-testid="fx-inner-shadow-toggle"]').setValue(true);
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.innerShadowColor).toBe('#000000');
		expect(style.innerShadowOpacity).toBe(0.5);
		expect(style.innerShadowBlur).toBe(5);
		expect(style.innerShadowOffsetX).toBe(0);
		expect(style.innerShadowOffsetY).toBe(0);
	});

	it('disables inner shadow by setting innerShadowColor transparent', async () => {
		const wrapper = mount(EffectsShadowSection, {
			props: { element: shape({ innerShadowColor: '#ff0000' }) },
		});
		await wrapper.find('[data-testid="fx-inner-shadow-toggle"]').setValue(false);
		expect(lastPatch(wrapper).shapeStyle.innerShadowColor).toBe('transparent');
	});

	it('merges an inner shadow offset edit onto the current shapeStyle', async () => {
		// No outer shadow color is set, so only the inner-shadow fields grid
		// renders: [blur, offsetX, offsetY] number inputs, in that template order.
		const wrapper = mount(EffectsShadowSection, {
			props: { element: shape({ innerShadowColor: '#ff0000', innerShadowBlur: 5 }) },
		});
		const numberInputs = wrapper.findAll('input[type="number"]');
		expect(numberInputs).toHaveLength(3);
		await numberInputs[1].setValue('10'); // offsetX
		const style = lastPatch(wrapper).shapeStyle;
		expect(style.innerShadowOffsetX).toBe(10);
		expect(style.innerShadowColor).toBe('#ff0000');
	});
});
