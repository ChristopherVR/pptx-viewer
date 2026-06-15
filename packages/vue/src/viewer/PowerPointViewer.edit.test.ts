import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PowerPointViewer from './PowerPointViewer.vue';

/**
 * Smoke test for the editing wiring. With no `content`, `useLoadContent` settles
 * to an empty (non-loading) presentation, so the viewer chrome renders and we
 * can assert the editor toolbar only appears when `canEdit` is set.
 */
describe('powerPointViewer editing wiring', () => {
	it('hides the editor toolbar when not editable', async () => {
		const wrapper = mount(PowerPointViewer, { props: { canEdit: false } });
		await flushPromises();
		expect(wrapper.find('.pptx-vue-editor-toolbar').exists()).toBeFalsy();
		expect(wrapper.find('.pptx-vue-selection-overlay').exists()).toBeFalsy();
	});

	it('renders the editor toolbar when editable', async () => {
		const wrapper = mount(PowerPointViewer, { props: { canEdit: true } });
		await flushPromises();
		const toolbar = wrapper.find('.pptx-vue-editor-toolbar');
		expect(toolbar.exists()).toBeTruthy();
		// Undo/redo start disabled (empty history); add-text/shape are always enabled.
		const undo = toolbar.get('[aria-label="Undo"]');
		expect(undo.attributes('disabled')).toBeDefined();
	});
});
