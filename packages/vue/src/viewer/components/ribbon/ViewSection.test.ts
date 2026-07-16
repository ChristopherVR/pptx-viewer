import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ViewSection from './ViewSection.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

describe('view section', () => {
	it('shows and runs zoom to fit when wired by the ribbon host', async () => {
		const onZoomToFit = vi.fn();
		const wrapper = mount(ViewSection, {
			props: {
				canEdit: true,
				editTemplateMode: false,
				onSetEditTemplateMode: vi.fn(),
				spellCheckEnabled: true,
				onSetSpellCheckEnabled: vi.fn(),
				showGrid: false,
				showRulers: false,
				snapToGrid: false,
				snapToShape: false,
				onSetShowGrid: vi.fn(),
				onSetShowRulers: vi.fn(),
				onSetSnapToGrid: vi.fn(),
				onSetSnapToShape: vi.fn(),
				onAddGuide: vi.fn(),
				onEnterMasterView: vi.fn(),
				onZoomToFit,
			},
		});

		await wrapper.get('[title="pptx.view.zoomToFitTooltip"]').trigger('click');

		expect(onZoomToFit).toHaveBeenCalledOnce();
	});
});
