import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PowerPointViewer from './PowerPointViewer.vue';

/**
 * Smoke test for the editing wiring. With no `content`, `useLoadContent` settles
 * to an empty (non-loading) presentation, so the viewer chrome renders. The
 * desktop chrome is the Office-style ribbon (`RibbonToolbar`); its ribbon tab
 * content only appears in edit/master mode, so it gates on `canEdit`.
 */
describe('powerPointViewer editing wiring', () => {
	it('hides the ribbon tab content when not editable', async () => {
		const wrapper = mount(PowerPointViewer, { props: { canEdit: false } });
		await flushPromises();
		// The ribbon's quick-access row still renders, but in preview mode there
		// are no ribbon tabs (and no selection overlay).
		expect(wrapper.find('button[aria-label="Toggle inspector"]').exists()).toBeFalsy();
		expect(wrapper.find('.pptx-vue-selection-overlay').exists()).toBeFalsy();
	});

	it('renders the Office ribbon when editable', async () => {
		const wrapper = mount(PowerPointViewer, { props: { canEdit: true } });
		await flushPromises();
		const ribbon = wrapper.find('[aria-label="Presentation toolbar"]');
		expect(ribbon.exists()).toBeTruthy();
		// Undo starts disabled (empty history) even though canEdit is set.
		const undo = ribbon.get('button[aria-label="Undo"]');
		expect(undo.attributes('disabled')).toBeDefined();
		// The format-painter hook the e2e contract depends on is present.
		expect(ribbon.find('[data-testid="format-painter-toggle"]').exists()).toBeTruthy();
	});
});
