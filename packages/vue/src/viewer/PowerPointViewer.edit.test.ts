import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ComparePanel from './components/ComparePanel.vue';
import VersionHistoryPanel from './components/VersionHistoryPanel.vue';
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

	// Regression test: File ▸ Version History and its restore/compare view were
	// fully wired up (state, ribbon action, restore/compare handlers) but the
	// two panels were never mounted in the template, so the feature was
	// unreachable. Both panels gate their own root element on an `open` prop,
	// so they should always be present in the tree (just hidden) once mounted.
	it('mounts the version-history and compare panels', async () => {
		const wrapper = mount(PowerPointViewer, { props: { canEdit: true } });
		await flushPromises();
		expect(wrapper.findComponent(VersionHistoryPanel).exists()).toBeTruthy();
		expect(wrapper.findComponent(ComparePanel).exists()).toBeTruthy();
	});
});
