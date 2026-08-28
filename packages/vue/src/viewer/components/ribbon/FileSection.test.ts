import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FileSection from './FileSection.vue';

/** Click the "Export" backstage-nav button (it has no aria-label, only its text). */
async function openExportPage(wrapper: VueWrapper): Promise<void> {
	const button = wrapper.findAll('nav button').find((btn) => btn.text().includes('Export'));
	if (!button) {
		throw new Error('Export nav button not found');
	}
	await button.trigger('click');
}

function mountFileSection(hiddenActions?: string[]) {
	return mount(FileSection, {
		props: {
			onClose: () => {},
			onCreatePresentation: () => {},
			onExportPng: () => {},
			onExportPdf: () => {},
			onExportJson: () => {},
			onExportVideo: () => {},
			onExportGif: () => {},
			onSaveAsPptx: () => {},
			onSaveAsPpsx: () => {},
			onSaveAsPptm: () => {},
			hasMacros: false,
			onCopySlideAsImage: () => {},
			onPrint: () => {},
			hiddenActions,
		},
	});
}

/**
 * FileSection: the File-tab backstage. Covers the `hiddenActions` gating
 * added for issue #64: navigating to the Export page shows its action cards
 * by default, and shows none when the host hides the shared 'export' id.
 */
describe('fileSection', () => {
	it('shows the Export page action cards by default', async () => {
		const wrapper = mountFileSection(undefined);
		await openExportPage(wrapper);
		expect(wrapper.text()).toContain('Create PDF');
	});

	it('shows no action cards on the Export page when "export" is hidden', async () => {
		const wrapper = mountFileSection(['export']);
		await openExportPage(wrapper);
		expect(wrapper.text()).not.toContain('Create PDF');
	});
});
