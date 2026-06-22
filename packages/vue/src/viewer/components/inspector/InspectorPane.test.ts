// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

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
		// Desktop: fixed 15rem column with a left divider.
		expect(aside.classes()).toContain('w-60');
		expect(aside.classes()).toContain('border-l');
		expect(aside.classes()).not.toContain('w-full');
	});

	it('switches to the full-width bottom-sheet body when mobile is set', () => {
		const wrapper = mount(InspectorPane, { props: { element: shape(), mobile: true } });
		const aside = wrapper.get('aside.pptx-vue-inspector');
		// Mobile: full width, no side divider (it lives inside MobileSheet).
		expect(aside.classes()).toContain('w-full');
		expect(aside.classes()).not.toContain('w-60');
		expect(aside.classes()).not.toContain('border-l');
	});
});
