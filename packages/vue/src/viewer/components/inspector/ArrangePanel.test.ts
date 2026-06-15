// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ArrangePanel from './ArrangePanel.vue';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp 1',
		x: 100,
		y: 50,
		width: 200,
		height: 120,
		rotation: 0,
		shapeStyle: {},
		...overrides,
	} as PptxElement;
}

function lastPatch(wrapper: ReturnType<typeof mount>): Partial<PptxElement> {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as Partial<PptxElement>;
}

describe('arrangePanel', () => {
	it('emits a shallow x patch when X changes', async () => {
		const wrapper = mount(ArrangePanel, { props: { element: shape() } });
		const input = wrapper.findAll('input[type="number"]')[0];
		await input.setValue('120');
		expect(lastPatch(wrapper)).toStrictEqual({ x: 120 });
	});

	it('emits a shallow y patch when Y changes', async () => {
		const wrapper = mount(ArrangePanel, { props: { element: shape() } });
		const input = wrapper.findAll('input[type="number"]')[1];
		await input.setValue('75');
		expect(lastPatch(wrapper)).toStrictEqual({ y: 75 });
	});

	it('clamps width to the minimum size', async () => {
		const wrapper = mount(ArrangePanel, { props: { element: shape() } });
		const input = wrapper.findAll('input[type="number"]')[2];
		await input.setValue('0');
		expect(lastPatch(wrapper)).toStrictEqual({ width: 1 });
	});

	it('emits a rotation patch', async () => {
		const wrapper = mount(ArrangePanel, { props: { element: shape() } });
		const input = wrapper.findAll('input[type="number"]')[4];
		await input.setValue('45');
		expect(lastPatch(wrapper)).toStrictEqual({ rotation: 45 });
	});

	it('emits flip toggle patches', async () => {
		const wrapper = mount(ArrangePanel, { props: { element: shape() } });
		const checks = wrapper.findAll('input[type="checkbox"]');
		await checks[0].setValue(true);
		expect(lastPatch(wrapper)).toStrictEqual({ flipHorizontal: true });
		await checks[1].setValue(true);
		expect(lastPatch(wrapper)).toStrictEqual({ flipVertical: true });
	});
});
