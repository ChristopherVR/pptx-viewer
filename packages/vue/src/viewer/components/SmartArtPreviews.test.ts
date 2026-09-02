import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SmartArtPreviews from './SmartArtPreviews.vue';

/**
 * Pins `SmartArtPreviews.vue`'s gallery-tile sizing and preview-element build
 * (via shared `buildSmartArtPreviewElement`), so the wiring cannot silently
 * drift from what `InsertSmartArtDialog.vue`'s "Insert" action creates.
 */
describe('smartArtPreviews', () => {
	it('scales the 600x340 preview box down to the 64px gallery tile', () => {
		const wrapper = mount(SmartArtPreviews, { props: { layout: 'basicBlockList' } });
		const outer = wrapper.get('.pptx-vue-smartart-preview');
		expect(outer.attributes('style')).toContain('width: 64px');
		// 340 * (64 / 600) = 36.2666... rounds to 36.
		expect(outer.attributes('style')).toContain('height: 36px');

		const scaled = wrapper.get('.pptx-vue-smartart-preview > div');
		expect(scaled.attributes('style')).toContain('width: 600px');
		expect(scaled.attributes('style')).toContain('height: 340px');
	});

	it('renders a live SmartArtRenderer output for the preset preview element', () => {
		const wrapper = mount(SmartArtPreviews, { props: { layout: 'basicBlockList' } });
		// The renderer mounts the smartArt element built by shared's
		// buildSmartArtPreviewElement under a fixed, layout-derived id.
		expect(
			wrapper.find('[data-element-id="smartart-preview-basicBlockList"]').exists(),
		).toBeTruthy();
	});
});
