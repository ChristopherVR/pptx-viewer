import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import PresentationPropertiesPanel from './PresentationPropertiesPanel.vue';

/**
 * `SlideTransitionSection.vue` and the `SlideTransitionPanel.vue` it owns were
 * built and then mounted nowhere, which (with an inert Transitions ribbon) left
 * Vue with no way to author a slide transition at all. This asserts the SLIDE
 * TRANSITION card is reachable from the inspector and commits a slide patch.
 */
const slide = {
	id: 's1',
	elements: [],
	transition: { type: 'fade', durationMs: 1000 },
} as unknown as PptxSlide;

function mountPanel() {
	return mount(PresentationPropertiesPanel, { props: { slide, canEdit: true } });
}

describe('presentationPropertiesPanel slide transition card', () => {
	it('renders the SLIDE TRANSITION section', () => {
		expect(mountPanel().text()).toContain('Slide transition');
	});

	it('commits a transition edit as a slide-update patch', async () => {
		const wrapper = mountPanel();
		const advance = wrapper.find('[data-testid="transition-advance"]');
		expect(advance.exists()).toBeTruthy();
		await advance.setValue(false);
		const updates = wrapper.emitted('slide-update');
		expect(updates).toBeTruthy();
		expect(updates?.[0]?.[0]).toStrictEqual({
			transition: expect.objectContaining({ type: 'fade', advanceOnClick: false }),
		});
	});
});
