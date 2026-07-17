import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SlideShowSection from './SlideShowSection.vue';

function mountSlideShowSection(hiddenActions?: string[]) {
	return mount(SlideShowSection, {
		props: {
			onPresent: () => {},
			onEnterPresenterView: () => {},
			onEnterRehearsalMode: () => {},
			onOpenSetUpSlideShow: () => {},
			onOpenBroadcastDialog: () => {},
			onToggleSubtitles: () => {},
			showSubtitles: false,
			onSetMode: () => {},
			hiddenActions,
		},
	});
}

/**
 * SlideShowSection: the Slide Show ribbon tab. Covers the `hiddenActions`
 * gating added for issue #64: the Broadcast button maps to the shared
 * 'broadcast' ToolbarActionId and hides independently of the rest of the tab.
 */
describe('slideShowSection', () => {
	it('renders the Broadcast button by default (hiddenActions omitted)', () => {
		const wrapper = mountSlideShowSection(undefined);
		expect(wrapper.text()).toContain('Broadcast');
	});

	it('hides the Broadcast button when "broadcast" is in hiddenActions', () => {
		const wrapper = mountSlideShowSection(['broadcast']);
		expect(wrapper.text()).not.toContain('Broadcast');
		// The rest of the tab stays intact.
		expect(wrapper.text()).toContain('Presenter View');
	});
});
