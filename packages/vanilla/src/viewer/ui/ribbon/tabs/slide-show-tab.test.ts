import type { PptxPresentationProperties } from 'pptx-viewer-core';
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
		showOptions: () => ({}),
		updateShowOptions: vi.fn(),
		...over,
	};
}

/** A handler bag backed by a mutable deck, like the store the ribbon reads. */
function withDeck(properties: PptxPresentationProperties): {
	handlers: RibbonSlideShowHandlers;
	properties: PptxPresentationProperties;
} {
	const deck: PptxPresentationProperties = { ...properties };
	const handlers = makeHandlers({
		showOptions: () => deck,
		updateShowOptions: (patch) => Object.assign(deck, patch),
	});
	return { handlers, properties: deck };
}

function control(tab: { el: HTMLElement }, label: string): HTMLElement {
	const controls: HTMLElement[] = [];
	const visit = (root: Element | ShadowRoot) => {
		controls.push(...root.querySelectorAll<HTMLElement>('button, pptx-ui-checkbox'));
		for (const element of root.querySelectorAll('*')) {
			if (element.shadowRoot) {
				visit(element.shadowRoot);
			}
		}
	};
	visit(tab.el);
	const match = controls.find(
		(node) => node.getAttribute('aria-label') === label || node.textContent?.trim() === label,
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

	it('disables the options the shared descriptor list marks unsupported', () => {
		const t = createTranslator();
		const tab = createSlideShowTab(document, t, makeHandlers());
		// Keep Slides Updated and Show Media Controls have no backing state in any
		// binding, so they render disabled rather than toggling and doing nothing.
		for (const label of [t('pptx.slideShow.keepUpdated'), t('pptx.slideShow.mediaControls')]) {
			const input = control(tab, label) as HTMLInputElement;
			expect(input.disabled).toBeTruthy();
			expect(input.checked).toBeFalsy();
		}
		for (const label of [t('pptx.slideShow.useTimings'), t('pptx.slideShow.playNarrations')]) {
			expect((control(tab, label) as HTMLInputElement).disabled).toBeFalsy();
		}
	});

	it('reads the supported options off the deck instead of assuming they are on', () => {
		const t = createTranslator();
		const { handlers } = withDeck({ advanceMode: 'manual', showWithNarration: false });
		const tab = createSlideShowTab(document, t, handlers);
		expect((control(tab, t('pptx.slideShow.useTimings')) as HTMLInputElement).checked).toBeFalsy();
		expect(
			(control(tab, t('pptx.slideShow.playNarrations')) as HTMLInputElement).checked,
		).toBeFalsy();
	});

	it('unticking Use Timings puts the deck into manual advance', () => {
		const t = createTranslator();
		const { handlers, properties } = withDeck({});
		const tab = createSlideShowTab(document, t, handlers);
		const input = control(tab, t('pptx.slideShow.useTimings')) as HTMLInputElement;
		expect(input.checked).toBeTruthy();
		input.checked = false;
		input.dispatchEvent(new Event('change'));
		expect(properties.advanceMode).toBe('manual');

		input.checked = true;
		input.dispatchEvent(new Event('change'));
		expect(properties.advanceMode).toBe('useTimings');
	});

	it('unticking Play Narrations turns the deck narration flag off', () => {
		const t = createTranslator();
		const { handlers, properties } = withDeck({});
		const tab = createSlideShowTab(document, t, handlers);
		const input = control(tab, t('pptx.slideShow.playNarrations')) as HTMLInputElement;
		input.checked = false;
		input.dispatchEvent(new Event('change'));
		expect(properties).toStrictEqual({ showWithNarration: false });
	});

	it('syncOptions re-reads the deck after the Set Up Show dialog changes it', () => {
		const t = createTranslator();
		const { handlers, properties } = withDeck({});
		const tab = createSlideShowTab(document, t, handlers);
		const input = control(tab, t('pptx.slideShow.useTimings')) as HTMLInputElement;
		expect(input.checked).toBeTruthy();
		properties.advanceMode = 'manual';
		tab.syncOptions();
		expect(input.checked).toBeFalsy();
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

function harness(hiddenActions?: readonly ['broadcast']) {
	const handlers: RibbonSlideShowHandlers = {
		startFromBeginning: vi.fn(),
		startFromCurrent: vi.fn(),
		openPresenterView: vi.fn(),
		openBroadcast: vi.fn(),
		openSetUp: vi.fn(),
		toggleHideSlide: vi.fn(),
		startRehearsal: vi.fn(),
		openCustomShows: vi.fn(),
		toggleSubtitles: vi.fn(),
		openSubtitleSettings: vi.fn(),
		showOptions: () => ({}),
		updateShowOptions: vi.fn(),
	};
	const tab = createSlideShowTab(document, (key) => key, handlers, hiddenActions);
	document.body.append(tab.el);
	const command = (id: string) => {
		const root = tab.el.querySelector(`[data-ribbon-control="${id}"]`)!.shadowRoot!;
		return (
			root.querySelector('pptx-ui-ribbon-command')?.shadowRoot!.querySelector('button') ??
			root.querySelector('button')!
		);
	};
	return { tab, handlers, command };
}

describe('vanilla shared Slide Show ribbon adapter', () => {
	it('reconnects a tab and recreates another without sharing or duplicating handlers', () => {
		const first = harness();
		const second = harness();
		try {
			for (let i = 0; i < 3; i++) {
				first.tab.el.remove();
				document.body.append(first.tab.el);
			}
			first.command('slideShow.startSlideShow.fromBeginning').click();
			expect(first.handlers.startFromBeginning).toHaveBeenCalledOnce();
			expect(second.handlers.startFromBeginning).not.toHaveBeenCalled();
			first.tab.el.remove();
			const remounted = harness();
			try {
				remounted.command('slideShow.startSlideShow.fromBeginning').click();
				expect(remounted.handlers.startFromBeginning).toHaveBeenCalledOnce();
				expect(first.handlers.startFromBeginning).toHaveBeenCalledOnce();
			} finally {
				remounted.tab.el.remove();
			}
			second.command('slideShow.startSlideShow.fromBeginning').click();
			expect(second.handlers.startFromBeginning).toHaveBeenCalledOnce();
		} finally {
			first.tab.el.remove();
			second.tab.el.remove();
		}
	});

	it('dispatches commands to distinct host callbacks and reflects Hide Slide state', () => {
		const { tab, handlers, command } = harness();
		try {
			command('slideShow.startSlideShow.fromBeginning').click();
			command('slideShow.startSlideShow.fromCurrent').click();
			command('slideShow.setUp.rehearseWithCoach').click();
			expect(handlers.startFromBeginning).toHaveBeenCalledOnce();
			expect(handlers.startFromCurrent).toHaveBeenCalledOnce();
			tab.setHideSlideActive(true);
			expect(command('slideShow.setUp.hideSlide').getAttribute('aria-pressed')).toBe('true');
			command('slideShow.setUp.hideSlide').click();
			expect(handlers.toggleHideSlide).toHaveBeenCalledOnce();
		} finally {
			tab.el.remove();
		}
	});

	it('keeps caption actions distinct and omits a host-hidden Broadcast command', () => {
		const { tab, handlers, command } = harness(['broadcast']);
		try {
			expect(
				tab.el.querySelector('[data-ribbon-control="slideShow.present.broadcast"]'),
			).toBeNull();
			tab.setSubtitlesVisible(true);
			const subtitles = tab.el.querySelector(
				'[data-ribbon-control="slideShow.captions.subtitles"]',
			)!;
			subtitles.shadowRoot!.querySelector('label')!.click();
			expect(handlers.toggleSubtitles).toHaveBeenCalledOnce();
			command('slideShow.captions.subtitleSettings').click();
			expect(
				tab.el.querySelector('pptx-ui-subtitle-settings')!.shadowRoot!.querySelector('dialog')!
					.open,
			).toBeTruthy();
			expect(handlers.toggleSubtitles).toHaveBeenCalledOnce();
			expect(handlers.openSetUp).not.toHaveBeenCalled();
		} finally {
			tab.el.remove();
		}
	});
});
