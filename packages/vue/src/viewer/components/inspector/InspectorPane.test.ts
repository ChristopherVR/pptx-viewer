// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import AnimationPanel from './AnimationPanel.vue';
import InspectorPane from './InspectorPane.vue';

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

describe('inspectorPane responsive layout', () => {
	it('uses the fixed-width side-panel layout by default (desktop)', () => {
		const wrapper = mount(InspectorPane, { props: { element: shape() } });
		const aside = wrapper.get('aside.pptx-vue-inspector');
		// Desktop: fixed 18rem column with a left divider.
		expect(aside.classes()).toContain('w-72');
		expect(aside.classes()).toContain('border-l');
		expect(aside.classes()).not.toContain('w-full');
	});

	it('switches to the full-width bottom-sheet body when mobile is set', () => {
		const wrapper = mount(InspectorPane, { props: { element: shape(), mobile: true } });
		const aside = wrapper.get('aside.pptx-vue-inspector');
		// Mobile: full width, no side divider (it lives inside MobileSheet).
		expect(aside.classes()).toContain('w-full');
		expect(aside.classes()).not.toContain('w-72');
		expect(aside.classes()).not.toContain('border-l');
	});

	it('relays full slide animation timeline updates to the viewer host', () => {
		const animations = [
			{ elementId: 'b', entrance: 'fadeIn', order: 0 },
			{ elementId: 'a', entrance: 'flyIn', order: 1 },
		] as PptxElementAnimation[];
		const wrapper = mount(InspectorPane, {
			props: { element: shape(), slideElements: [shape()], slideAnimations: animations },
		});
		wrapper.getComponent(AnimationPanel).vm.$emit('updateSlideAnimations', animations);
		expect(wrapper.emitted('updateSlideAnimations')?.[0]?.[0]).toStrictEqual(animations);
	});
});
