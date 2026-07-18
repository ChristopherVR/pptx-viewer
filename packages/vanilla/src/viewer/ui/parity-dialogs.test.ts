import type { PptxSlide } from 'pptx-viewer-core';
import { compareSlides, createViewerOptionsStore, THEME_CATALOG } from 'pptx-viewer-shared';
import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { openComparePanel } from './compare-panel';
import { openHeaderFooterDialog } from './header-footer-dialog';
import { openPrintSettingsDialog } from './print-settings-dialog';
import { openSettingsDialog } from './settings-dialog';
import { openSlideShowDialog } from './slide-show-dialog';

afterEach(() => document.body.replaceChildren());

function slide(id: string, text = ''): PptxSlide {
	return {
		id,
		rId: id,
		slideNumber: 1,
		elements: text ? [{ id: 'text', type: 'text', x: 0, y: 0, width: 100, height: 20, text }] : [],
	} as PptxSlide;
}

describe('remaining parity dialogs', () => {
	it('shows the shared shortcut reference and persists settings', () => {
		localStorage.clear();
		const store = createViewerOptionsStore();
		openSettingsDialog(document, createTranslator(), {
			store,
			initialTab: 'ribbon',
			onClearCache: vi.fn(),
			themeOptions: { catalog: THEME_CATALOG, currentKey: 'default', onSelect: vi.fn() },
			localeOptions: { catalog: LOCALE_CATALOG, currentCode: 'en', onSelect: vi.fn() },
		});
		// The Customize Ribbon pane carries the keyboard-shortcut reference.
		expect(document.body.textContent).toContain('Ctrl/Cmd+C');
		const advanced = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Advanced',
		)!;
		advanced.click();
		const grid = Array.from(document.querySelectorAll('label'))
			.find((label) => label.textContent === 'Show grid')!
			.querySelector<HTMLInputElement>('input')!;
		grid.click();
		expect(store.getOptions().advanced.showGrid).toBeTruthy();
	});

	it('saves show range and kiosk settings', () => {
		const onSave = vi.fn();
		openSlideShowDialog(document, createTranslator(), {}, 6, onSave);
		const kiosk = Array.from(document.querySelectorAll('label'))
			.find((label) => label.textContent?.includes('kiosk'))!
			.querySelector<HTMLInputElement>('input')!;
		kiosk.click();
		const ok = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'OK',
		)!;
		ok.click();
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ showType: 'kiosk', loopContinuously: true }),
		);
	});

	it('renders comparison results and accepts a changed slide', () => {
		const result = compareSlides([slide('one', 'Before')], [slide('one', 'After')]);
		const onAccept = vi.fn();
		openComparePanel(document, document.body, createTranslator(), {
			result,
			onAccept,
			onAcceptAll: vi.fn(),
		});
		expect(document.body.textContent).toContain('1 changed');
		const accept = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Accept',
		)!;
		accept.click();
		expect(onAccept).toHaveBeenCalledWith(result.diffs[0]);
	});

	it('collects print layout, range, orientation, and color settings', () => {
		const onPrint = vi.fn();
		openPrintSettingsDialog(document, createTranslator(), 5, onPrint);
		const selects = document.querySelectorAll<HTMLSelectElement>('select');
		selects[0].value = 'current';
		selects[1].value = 'notes';
		selects[2].value = 'portrait';
		selects[3].value = 'grayscale';
		const print = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Print',
		)!;
		print.click();
		expect(onPrint).toHaveBeenCalledWith(
			expect.objectContaining({
				slideRange: 'current',
				printWhat: 'notes',
				orientation: 'portrait',
				colorMode: 'grayscale',
			}),
		);
	});

	it('applies footer fields to the requested scope', () => {
		const onApply = vi.fn();
		openHeaderFooterDialog(document, createTranslator(), { value: {}, onApply });
		const footer = Array.from(document.querySelectorAll('label'))
			.find((label) => label.textContent === 'Footer')!
			.querySelector<HTMLInputElement>('input')!;
		footer.click();
		const text = document.querySelector<HTMLInputElement>('input[type="text"]')!;
		text.value = 'Confidential';
		const apply = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Apply to All',
		)!;
		apply.click();
		expect(onApply).toHaveBeenCalledWith(
			expect.objectContaining({ hasFooter: true, footerText: 'Confidential' }),
			'all',
		);
	});
});
