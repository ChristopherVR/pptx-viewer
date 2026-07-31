import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SlideShowSection from './SlideShowSection.vue';

const customShowControls = {
	customShows: [],
	activeCustomShowId: null,
	canEdit: true,
	isCurrentSlideInActiveShow: false,
	onSetActiveCustomShowId: () => {},
	onCreateCustomShow: () => {},
	onRenameActiveCustomShow: () => {},
	onDeleteActiveCustomShow: () => {},
	onToggleCurrentSlideInActiveShow: () => {},
};

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
			customShowControls,
			hiddenActions,
		},
	});
}

/** The Custom show command, by the accessible name the inventory compares. */
function customShowButton(wrapper: ReturnType<typeof mountSlideShowSection>) {
	return wrapper.findAll('button').find((b) => b.text() === 'Custom show');
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

	// The tab used to offer six controls where the React reference offers
	// fifteen. A short tab breaks no layout spec, so it is asserted by name.
	it('offers every control the reference offers', () => {
		const text = mountSlideShowSection(undefined).text();
		for (const control of [
			'From Beginning',
			'From Current Slide',
			'Presenter View',
			'Custom show',
			'Broadcast',
			'Rehearse with Coach',
			'Set Up Slide Show',
			'Hide Slide',
			'Rehearse Timings',
			'Record',
			'Keep Slides Updated',
			'Using timings, if present',
			'Play Narrations',
			'Show Media Controls',
			'Subtitles',
			'Subtitle Settings',
		]) {
			expect(text).toContain(control);
		}
	});

	/**
	 * Custom show used to render disabled with no handler while the picker it
	 * should open (`CustomShowsControls.vue`) already existed. The popover has
	 * to start CLOSED or the tab's control inventory changes just by being
	 * rendered.
	 */
	it('offers Custom show as a live command whose picker starts closed', async () => {
		const wrapper = mountSlideShowSection(undefined);
		const button = customShowButton(wrapper);

		expect(button?.attributes('disabled')).toBeUndefined();
		expect(button?.attributes('aria-expanded')).toBe('false');
		expect(wrapper.text()).not.toContain('+ Show');

		await button?.trigger('click');

		expect(customShowButton(wrapper)?.attributes('aria-expanded')).toBe('true');
		expect(wrapper.text()).toContain('+ Show');
	});

	it('exposes the show options as labelled checkboxes', () => {
		const wrapper = mountSlideShowSection(undefined);
		const labels = wrapper.findAll('label').map((l) => l.text());
		expect(labels).toContain('Play Narrations');
		// Keep Slides Updated has no backing feature in any binding yet.
		const keepUpdated = wrapper.findAll('label').find((l) => l.text() === 'Keep Slides Updated');
		expect(keepUpdated?.find('input').attributes('disabled')).toBeDefined();
	});
});
