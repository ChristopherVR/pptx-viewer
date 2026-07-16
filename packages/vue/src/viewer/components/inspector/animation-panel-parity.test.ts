import { mount } from '@vue/test-utils';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { previewVueAnimation, stopVueAnimationPreview } from './animation-preview-player';
import AnimationPanel from './AnimationPanel.vue';
import AnimationTimeline from './AnimationTimeline.vue';

const selected = {
	type: 'shape',
	id: 'selected',
	x: 0,
	y: 0,
	width: 100,
	height: 50,
	animations: [{ elementId: 'selected', entrance: 'fadeIn', trigger: 'onShapeClick' }],
} as PptxElement & { animations: PptxElementAnimation[] };
const elements = [
	selected,
	{ type: 'shape', id: 'animated', name: 'Animated shape', x: 0, y: 0, width: 10, height: 10 },
	{ type: 'text', id: 'plain', text: 'Unanimated trigger', x: 0, y: 0, width: 10, height: 10 },
] as PptxElement[];

function latestAnimation(wrapper: ReturnType<typeof mount>): PptxElementAnimation {
	const event = wrapper.emitted('update')?.at(-1)?.[0] as { animations: PptxElementAnimation[] };
	return event.animations[0];
}

afterEach(() => {
	stopVueAnimationPreview();
	document.body.replaceChildren();
	vi.useRealTimers();
});

describe('vue animation parity controls', () => {
	it('edits timing, direction, sequence, curve, and repeat fields', async () => {
		const wrapper = mount(AnimationPanel, {
			props: { element: selected, slideElements: elements },
		});
		await wrapper.get('[aria-label="Animation duration"]').setValue(750);
		expect(latestAnimation(wrapper).durationMs).toBe(750);
		await wrapper.get('[aria-label="Animation delay"]').setValue(125);
		expect(latestAnimation(wrapper).delayMs).toBe(125);
		await wrapper.get('[aria-label="Animation direction"]').setValue('fromBottomRight');
		expect(latestAnimation(wrapper).direction).toBe('fromBottomRight');
		await wrapper.get('[aria-label="Animation sequence"]').setValue('byWord');
		expect(latestAnimation(wrapper).sequence).toBe('byWord');
		await wrapper.get('[aria-label="Animation timing curve"]').setValue('linear');
		expect(latestAnimation(wrapper).timingCurve).toBe('linear');
		await wrapper.get('[aria-label="Animation repeat count"]').setValue(3);
		expect(latestAnimation(wrapper).repeatCount).toBe(3);
		await wrapper.get('[aria-label="Animation repeat mode"]').setValue('untilEndOfSlide');
		expect(latestAnimation(wrapper).repeatMode).toBe('untilEndOfSlide');
	});

	it('lists and authors all triggers plus every other active-slide element', async () => {
		const wrapper = mount(AnimationPanel, {
			props: { element: selected, slideElements: elements },
		});
		const triggerValues = wrapper
			.get('[aria-label="Animation trigger"]')
			.findAll('option')
			.map((o) => o.attributes('value'));
		expect(triggerValues).toStrictEqual(
			expect.arrayContaining(['onHover', 'onShapeClick', 'afterDelay']),
		);
		const shapeOptions = wrapper.get('[aria-label="Animation trigger shape"]').text();
		expect(shapeOptions).toContain('Animated shape');
		expect(shapeOptions).toContain('Unanimated trigger');
		await wrapper.get('[aria-label="Animation trigger shape"]').setValue('plain');
		expect(latestAnimation(wrapper).triggerShapeId).toBe('plain');
		await wrapper
			.get('[data-animation-editor] [aria-label="Animation trigger"]')
			.setValue('onHover');
		expect(latestAnimation(wrapper)).toMatchObject({
			trigger: 'onHover',
			triggerShapeId: undefined,
		});
	});

	it('reorders the native full-slide timeline by drag and drop', async () => {
		const animations = [
			{ elementId: 'selected', entrance: 'fadeIn', order: 0 },
			{ elementId: 'animated', entrance: 'flyIn', order: 1 },
		] as PptxElementAnimation[];
		const wrapper = mount(AnimationTimeline, {
			props: { animations, elements, selectedElementId: 'selected' },
		});
		const rows = wrapper.findAll('[draggable="true"]');
		await rows[0].trigger('dragstart', { dataTransfer: { setData: vi.fn() } });
		await rows[1].trigger('drop', { preventDefault: vi.fn() });
		const reordered = wrapper.emitted('reorder')?.[0]?.[0] as PptxElementAnimation[];
		expect(reordered.map((animation) => animation.elementId)).toStrictEqual([
			'animated',
			'selected',
		]);
		expect(reordered.map((animation) => animation.order)).toStrictEqual([0, 1]);
	});

	it('previews the real Vue canvas node and restores it', () => {
		vi.useFakeTimers();
		const target = document.createElement('div');
		target.dataset['elementId'] = 'selected';
		target.style.animation = 'original 1s';
		document.body.appendChild(target);
		expect(previewVueAnimation(selected.animations[0])).toBeTruthy();
		expect(target.style.animation).not.toBe('original 1s');
		vi.runAllTimers();
		expect(target.style.animation).toBe('original 1s');
	});
});
