import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createRecentColorsRow } from './recent-colors-row';

describe('createRecentColorsRow', () => {
	it('is hidden until setColors is called with entries', () => {
		const t = createTranslator();
		const row = createRecentColorsRow(document, t, vi.fn());
		expect(row.el.hidden).toBeTruthy();

		row.setColors(['#112233', '#445566']);
		expect(row.el.hidden).toBeFalsy();
		expect(row.el.querySelectorAll('.pptxv-swatch')).toHaveLength(2);
	});

	it('hides again once setColors is called with an empty list', () => {
		const t = createTranslator();
		const row = createRecentColorsRow(document, t, vi.fn());
		row.setColors(['#112233']);
		expect(row.el.hidden).toBeFalsy();

		row.setColors([]);
		expect(row.el.hidden).toBeTruthy();
	});

	it('carries the row contract: data-testid, aria-label, and per-swatch title/aria-label', () => {
		const t = createTranslator();
		const row = createRecentColorsRow(document, t, vi.fn());
		row.setColors(['#112233']);

		expect(row.el.dataset.testid).toBe('pptx-color-recent');
		expect(row.el.getAttribute('aria-label')).toBe(t('pptx.colorPicker.recentColors'));
		const swatch = row.el.querySelector<HTMLButtonElement>('.pptxv-swatch')!;
		expect(swatch.type).toBe('button');
		expect(swatch.title).toBe('#112233');
		expect(swatch.getAttribute('aria-label')).toBe('Recent #112233');
	});

	it('fires onSelect for the clicked swatch, most-recent first', () => {
		const onSelect = vi.fn();
		const t = createTranslator();
		const row = createRecentColorsRow(document, t, onSelect);
		row.setColors(['#112233', '#445566']);

		row.el.querySelectorAll<HTMLButtonElement>('.pptxv-swatch')[1].click();

		expect(onSelect).toHaveBeenCalledExactlyOnceWith('#445566');
	});

	it('replaces the row on repeated calls rather than accumulating', () => {
		const t = createTranslator();
		const row = createRecentColorsRow(document, t, vi.fn());
		row.setColors(['#112233', '#445566']);
		row.setColors(['#778899']);

		expect(row.el.querySelectorAll('.pptxv-swatch')).toHaveLength(1);
	});

	it('setDisabled disables every swatch, including ones added afterward', () => {
		const t = createTranslator();
		const row = createRecentColorsRow(document, t, vi.fn());
		row.setColors(['#112233']);
		row.setDisabled(true);
		expect(row.el.querySelector<HTMLButtonElement>('.pptxv-swatch')!.disabled).toBeTruthy();

		row.setColors(['#112233', '#445566']);
		for (const btn of row.el.querySelectorAll<HTMLButtonElement>('.pptxv-swatch')) {
			expect(btn.disabled).toBeTruthy();
		}
	});
});
