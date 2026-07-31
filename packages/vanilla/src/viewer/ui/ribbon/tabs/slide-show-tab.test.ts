import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import type { RibbonSlideShowHandlers } from '../ribbon-types';
import { createSlideShowTab } from './slide-show-tab';

function makeHandlers(over: Partial<RibbonSlideShowHandlers> = {}): RibbonSlideShowHandlers {
	return {
		startFromBeginning: vi.fn(),
		startFromCurrent: vi.fn(),
		openPresenterView: vi.fn(),
		openBroadcast: vi.fn(),
		openSetUp: vi.fn(),
		startRehearsal: vi.fn(),
		openCustomShows: vi.fn(),
		toggleSubtitles: vi.fn(),
		openSubtitleSettings: vi.fn(),
		toggleHideSlide: vi.fn(),
		...over,
	};
}

function control(tab: { el: HTMLElement }, label: string): HTMLElement {
	const match = [...tab.el.querySelectorAll<HTMLElement>('button, input')].find(
		(node) => node.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing slide show control: ${label}`);
	}
	return match;
}

describe('createSlideShowTab', () => {
	it('names the start commands after their labels, not their tooltips', () => {
		const t = createTranslator();
		const tab = createSlideShowTab(document, t, makeHandlers());
		expect(control(tab, t('pptx.slideShow.fromBeginning')).title).toBe(
			t('pptx.slideShow.fromBeginningTooltip'),
		);
		expect(control(tab, t('pptx.slideShow.fromCurrent')).title).toBe(
			t('pptx.slideShow.fromCurrentTooltip'),
		);
	});

	it('offers the Set Up group including the unimplemented placeholders', () => {
		const t = createTranslator();
		const tab = createSlideShowTab(document, t, makeHandlers());
		expect(
			(control(tab, t('pptx.slideShow.rehearseCoach')) as HTMLButtonElement).disabled,
		).toBeTruthy();
		expect(control(tab, t('pptx.slideShow.setUp'))).toBeTruthy();
		expect(control(tab, t('pptx.slideShow.rehearseTimings'))).toBeTruthy();
	});

	it('toggles the active slide with Hide Slide and reflects its pressed state', () => {
		const t = createTranslator();
		const toggleHideSlide = vi.fn();
		const tab = createSlideShowTab(document, t, { ...makeHandlers(), toggleHideSlide });
		const button = control(tab, t('pptx.slideShow.hideSlide')) as HTMLButtonElement;
		expect(button.disabled).toBeFalsy();
		expect(button.getAttribute('aria-pressed')).toBe('false');
		button.click();
		expect(toggleHideSlide).toHaveBeenCalledOnce();
		// The pressed state follows the deck, pushed in by the store sync.
		tab.setHideSlideActive(true);
		expect(button.getAttribute('aria-pressed')).toBe('true');
	});

	it('starts a recording from the Record command', () => {
		const t = createTranslator();
		const startRehearsal = vi.fn();
		const tab = createSlideShowTab(document, t, makeHandlers({ startRehearsal }));
		(control(tab, t('pptx.titleBar.record')) as HTMLButtonElement).click();
		expect(startRehearsal).toHaveBeenCalledOnce();
	});

	it('offers the show options as toggles, with Keep Updated unavailable', () => {
		const t = createTranslator();
		const tab = createSlideShowTab(document, t, makeHandlers());
		expect(
			(control(tab, t('pptx.slideShow.keepUpdated')) as HTMLInputElement).disabled,
		).toBeTruthy();
		for (const label of [
			t('pptx.slideShow.useTimings'),
			t('pptx.slideShow.playNarrations'),
			t('pptx.slideShow.mediaControls'),
		]) {
			expect((control(tab, label) as HTMLInputElement).disabled).toBeFalsy();
		}
	});

	it('keeps Custom Shows usable, because this binding actually implements it', () => {
		const t = createTranslator();
		const openCustomShows = vi.fn();
		const tab = createSlideShowTab(document, t, makeHandlers({ openCustomShows }));
		const button = control(tab, t('pptx.slideShow.customShow')) as HTMLButtonElement;
		expect(button.disabled).toBeFalsy();
		button.click();
		expect(openCustomShows).toHaveBeenCalledOnce();
	});

	it('drops Broadcast when the host hides that action', () => {
		const t = createTranslator();
		const tab = createSlideShowTab(document, t, makeHandlers(), ['broadcast']);
		expect(() => control(tab, t('pptx.slideShow.broadcast'))).toThrow();
	});
});
