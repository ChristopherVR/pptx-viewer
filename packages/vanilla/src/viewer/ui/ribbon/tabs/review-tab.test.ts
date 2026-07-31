import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import type { RibbonNavHandlers } from '../ribbon-types';
import { createRecordTab } from './record-tab';
import { createReviewTab } from './review-tab';

function navHandlers(over: Partial<RibbonNavHandlers> = {}): RibbonNavHandlers {
	return {
		prev: vi.fn(),
		next: vi.fn(),
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		zoomToFit: vi.fn(),
		togglePresentation: vi.fn(),
		normalView: vi.fn(),
		toggleNotes: vi.fn(),
		openAccessibility: vi.fn(),
		openSettings: vi.fn(),
		openHeaderFooter: vi.fn(),
		openCompare: vi.fn(),
		openSelectionPane: vi.fn(),
		openSlideSorter: vi.fn(),
		openComments: vi.fn(),
		openHyperlink: vi.fn(),
		toggleViewOption: vi.fn(),
		addGuide: vi.fn(),
		activateEyedropper: vi.fn(),
		toggleSpellCheck: vi.fn(),
		...over,
	};
}

function button(el: HTMLElement, label: string): HTMLButtonElement {
	const match = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
		(item) => item.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing command: ${label}`);
	}
	return match;
}

describe('createReviewTab', () => {
	it('offers Proofing, Accessibility, Language, Changes, Comments and Protect', () => {
		const t = createTranslator();
		const tab = createReviewTab(document, t, navHandlers());
		for (const label of [
			t('pptx.review.spelling'),
			t('pptx.review.thesaurus'),
			t('pptx.review.accessibilityCheck'),
			t('pptx.review.translate'),
			t('pptx.review.language'),
			t('pptx.review.markAllRead'),
			t('pptx.ribbon.compare'),
			t('pptx.toolbar.comments'),
			t('pptx.common.delete'),
			t('pptx.common.previous'),
			t('pptx.common.next'),
			t('pptx.review.showComments'),
			t('pptx.review.readOnly'),
			t('pptx.review.restrictPermission'),
			t('pptx.review.hideInk'),
		]) {
			expect(button(tab.el, label)).toBeTruthy();
		}
	});

	it('dispatches the commands that are implemented', () => {
		const t = createTranslator();
		const toggleSpellCheck = vi.fn();
		const openComments = vi.fn();
		const openSettings = vi.fn();
		const tab = createReviewTab(
			document,
			t,
			navHandlers({ toggleSpellCheck, openComments, openSettings }),
		);
		button(tab.el, t('pptx.review.spelling')).click();
		button(tab.el, t('pptx.review.showComments')).click();
		button(tab.el, t('pptx.review.language')).click();
		expect(toggleSpellCheck).toHaveBeenCalledOnce();
		expect(openComments).toHaveBeenCalledOnce();
		expect(openSettings).toHaveBeenCalledWith('general');
	});

	it('renders the unimplemented Protect and comment-navigation commands disabled', () => {
		const t = createTranslator();
		const tab = createReviewTab(document, t, navHandlers());
		tab.setEditable(true);
		for (const label of [
			t('pptx.review.thesaurus'),
			t('pptx.review.translate'),
			t('pptx.common.previous'),
			t('pptx.review.readOnly'),
			t('pptx.review.hideInk'),
		]) {
			expect(button(tab.el, label).disabled).toBeTruthy();
		}
	});

	it('does not duplicate Header & Footer, which belongs to the Insert tab', () => {
		const t = createTranslator();
		const tab = createReviewTab(document, t, navHandlers());
		expect(() => button(tab.el, t('pptx.headerFooter.title'))).toThrow();
	});
});

describe('createRecordTab', () => {
	it('offers the Camera, Record, Manage and Help commands React does', () => {
		const t = createTranslator();
		const el = createRecordTab(document, t, {
			startFromBeginning: vi.fn(),
			startFromCurrent: vi.fn(),
			openPresenterView: vi.fn(),
			openBroadcast: vi.fn(),
			openSetUp: vi.fn(),
			startRehearsal: vi.fn(),
			openCustomShows: vi.fn(),
			toggleSubtitles: vi.fn(),
			openSubtitleSettings: vi.fn(),
		});
		for (const label of [
			t('pptx.record.cameo'),
			t('pptx.slideShow.fromBeginning'),
			t('pptx.slideShow.fromCurrent'),
			t('pptx.record.clear'),
			t('pptx.record.resetToCameo'),
			t('pptx.record.learnMore'),
		]) {
			expect(button(el, label)).toBeTruthy();
		}
		expect(button(el, t('pptx.record.cameo')).disabled).toBeTruthy();
		expect(button(el, t('pptx.slideShow.fromBeginning')).disabled).toBeFalsy();
	});
});
