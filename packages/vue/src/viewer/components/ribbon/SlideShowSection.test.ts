import { mount, DOMWrapper } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

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

function mountSlideShowSection(
	hiddenActions?: string[],
	onPresentFromBeginning: () => void = () => {},
) {
	return mount(SlideShowSection, {
		props: {
			onPresent: () => {},
			onPresentFromBeginning,
			onEnterPresenterView: () => {},
			onEnterRehearsalMode: () => {},
			onOpenSetUpSlideShow: () => {},
			onToggleHideSlide: () => {},
			activeSlideHidden: false,
			onOpenBroadcastDialog: () => {},
			onToggleSubtitles: () => {},
			showSubtitles: false,
			customShowControls,
			hiddenActions,
		},
	});
}

function commandButtons(wrapper: ReturnType<typeof mountSlideShowSection>) {
	return wrapper
		.findAll('pptx-ui-ribbon-command')
		.map((host) => new DOMWrapper(host.element.shadowRoot!.querySelector('button')!));
}
function customShowButton(wrapper: ReturnType<typeof mountSlideShowSection>) {
	return commandButtons(wrapper).find((button) => button.text() === 'Custom show');
}
function surfaceText(wrapper: ReturnType<typeof mountSlideShowSection>): string {
	return (
		wrapper.text() +
		(wrapper
			.find('pptx-ui-subtitle-settings')
			.element.shadowRoot?.querySelector('pptx-ui-ribbon-command')
			?.getAttribute('label') ?? '') +
		wrapper
			.findAll('pptx-ui-ribbon-command,pptx-ui-ribbon-group,pptx-ui-ribbon-toggle')
			.map((host) => host.attributes('label'))
			.join(' ') +
		wrapper.find('pptx-ui-slide-show-options').element.shadowRoot?.textContent
	);
}

/**
 * SlideShowSection: the Slide Show ribbon tab. Covers the `hiddenActions`
 * gating added for issue #64: the Broadcast button maps to the shared
 * 'broadcast' ToolbarActionId and hides independently of the rest of the tab.
 */
describe('slideShowSection', () => {
	it('keeps callbacks local and current after remounting one of two adapters', async () => {
		const old = vi.fn();
		const next = vi.fn();
		const other = vi.fn();
		const first = mountSlideShowSection(undefined, old);
		const second = mountSlideShowSection(undefined, other);
		const click = (view: ReturnType<typeof mountSlideShowSection>) =>
			commandButtons(view)
				.find((button) => button.text() === 'From Beginning')!
				.element.click();
		try {
			await first.setProps({ onPresentFromBeginning: next });
			click(first);
			expect(old).not.toHaveBeenCalled();
			expect(next).toHaveBeenCalledOnce();
			expect(other).not.toHaveBeenCalled();
			first.unmount();
			const remount = mountSlideShowSection(undefined, next);
			try {
				click(remount);
				expect(next).toHaveBeenCalledTimes(2);
			} finally {
				remount.unmount();
			}
			click(second);
			expect(other).toHaveBeenCalledOnce();
		} finally {
			first.unmount();
			second.unmount();
		}
	});

	it('renders the Broadcast button by default (hiddenActions omitted)', () => {
		const wrapper = mountSlideShowSection(undefined);
		expect(surfaceText(wrapper)).toContain('Broadcast');
	});

	it('hides the Broadcast button when "broadcast" is in hiddenActions', () => {
		const wrapper = mountSlideShowSection(['broadcast']);
		expect(surfaceText(wrapper)).not.toContain('Broadcast');
		// The rest of the tab stays intact.
		expect(surfaceText(wrapper)).toContain('Presenter View');
	});

	// The tab used to offer six controls where the React reference offers
	// fifteen. A short tab breaks no layout spec, so it is asserted by name.
	it('offers every control the reference offers', () => {
		const wrapper = mountSlideShowSection(undefined);
		const text = surfaceText(wrapper);
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
		expect(surfaceText(wrapper)).not.toContain('+ Show');

		await button?.trigger('click');

		expect(customShowButton(wrapper)?.attributes('aria-expanded')).toBe('true');
		expect(surfaceText(wrapper)).toContain('+ Show');
	});

	/**
	 * "From Beginning" and "From Current Slide" used to both call `onSetMode`
	 * with the SAME argument, so the ribbon could not tell them apart and both
	 * entered the show on the raw active slide (wave-4 B1). They now dispatch to
	 * two distinct callbacks.
	 */
	it('dispatches "From Beginning" and "From Current Slide" to distinct callbacks', async () => {
		let fromBeginningCalls = 0;
		const wrapper = mountSlideShowSection(undefined, () => {
			fromBeginningCalls += 1;
		});
		const buttons = commandButtons(wrapper);
		const fromBeginning = buttons.find((b) => b.text() === 'From Beginning');
		const fromCurrent = buttons.find((b) => b.text() === 'From Current Slide');

		await fromCurrent?.trigger('click');
		expect(fromBeginningCalls).toBe(0);

		await fromBeginning?.trigger('click');
		expect(fromBeginningCalls).toBe(1);
	});

	it('exposes the show options as labelled checkboxes', () => {
		const wrapper = mountSlideShowSection(undefined);
		const root = wrapper.find('pptx-ui-slide-show-options').element.shadowRoot!;
		const labels = [...root.querySelectorAll('label')].map((l) => l.textContent);
		expect(labels).toContain('Play Narrations');
		// Keep Slides Updated has no backing feature in any binding yet.
		expect(
			root.querySelector('[aria-label="Keep Slides Updated"]')?.hasAttribute('disabled'),
		).toBeTruthy();
	});
});

/**
 * The Options cluster used to be four hard-coded `checked` boxes with no change
 * handler, so "Use Timings" claimed to be on whether or not the deck said so
 * and unticking it did nothing. These assert EFFECT.
 */
describe('slideShowSection options cluster', () => {
	function mountWithProperties(
		presentationProperties: Record<string, unknown>,
		onPresentationPropertiesChange = () => {},
	) {
		return mount(SlideShowSection, {
			props: {
				onPresent: () => {},
				onPresentFromBeginning: () => {},
				onEnterPresenterView: () => {},
				onEnterRehearsalMode: () => {},
				onOpenSetUpSlideShow: () => {},
				onToggleHideSlide: () => {},
				activeSlideHidden: false,
				onOpenBroadcastDialog: () => {},
				onToggleSubtitles: () => {},
				showSubtitles: false,
				customShowControls,
				presentationProperties,
				onPresentationPropertiesChange,
			},
		});
	}

	function optionBox(wrapper: ReturnType<typeof mountWithProperties>, label: string) {
		const checkbox = wrapper
			.find('pptx-ui-slide-show-options')
			.element.shadowRoot!.querySelector(`pptx-ui-checkbox[aria-label="${label}"]`)!;
		return new DOMWrapper(checkbox);
	}

	it('reflects the deck rather than a hard-coded checked attribute', () => {
		const wrapper = mountWithProperties({ advanceMode: 'manual' });
		const box = optionBox(wrapper, 'Using timings, if present');
		if (!box) {
			throw new Error('the Use Timings checkbox must exist');
		}
		expect((box.element as HTMLInputElement).checked).toBeFalsy();
	});

	it('commits Use Timings onto the presentation properties', async () => {
		const changes: Record<string, unknown>[] = [];
		const wrapper = mountWithProperties({}, (patch: Record<string, unknown>) =>
			changes.push(patch),
		);
		(optionBox(wrapper, 'Using timings, if present').element as HTMLElement).click();
		expect(changes).toStrictEqual([{ advanceMode: 'manual' }]);
	});

	it('commits Play Narrations onto the presentation properties', async () => {
		const changes: Record<string, unknown>[] = [];
		const wrapper = mountWithProperties({}, (patch: Record<string, unknown>) =>
			changes.push(patch),
		);
		(optionBox(wrapper, 'Play Narrations').element as HTMLElement).click();
		expect(changes).toStrictEqual([{ showWithNarration: false }]);
	});

	it('disables the two options nothing backs', () => {
		const wrapper = mountWithProperties({});
		expect(optionBox(wrapper, 'Keep Slides Updated')?.attributes('disabled')).toBeDefined();
		expect(optionBox(wrapper, 'Show Media Controls')?.attributes('disabled')).toBeDefined();
	});
});
