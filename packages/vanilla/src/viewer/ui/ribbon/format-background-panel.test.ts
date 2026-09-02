import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createFormatBackgroundPanel } from './format-background-panel';

describe('createFormatBackgroundPanel', () => {
	it('drives the background live on input and records the committed pick as a recent colour', () => {
		const t = createTranslator();
		const setSlideBackgroundColor = vi.fn();
		const pushRecentColor = vi.fn();
		const panel = createFormatBackgroundPanel(document, t, {
			setSlideBackgroundColor,
			clearSlideBackground: vi.fn(),
			setHideBackgroundGraphics: vi.fn(),
			pushRecentColor,
		});
		const input = panel.el.querySelector<HTMLInputElement>('input[type="color"]')!;

		input.value = '#123456';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(setSlideBackgroundColor).toHaveBeenCalledWith('#123456');
		// Dragging inside the native dialog streams `input` events: none of
		// those is a pick.
		expect(pushRecentColor).not.toHaveBeenCalled();

		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(pushRecentColor).toHaveBeenCalledWith('#123456');
	});

	it('tolerates a caller without a recent-colours sink', () => {
		const t = createTranslator();
		const panel = createFormatBackgroundPanel(document, t, {
			setSlideBackgroundColor: vi.fn(),
			clearSlideBackground: vi.fn(),
			setHideBackgroundGraphics: vi.fn(),
		});
		const input = panel.el.querySelector<HTMLInputElement>('input[type="color"]')!;
		expect(() => input.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
	});

	it('toggles Hide Background Graphics via the checkbox', () => {
		const t = createTranslator();
		const setHideBackgroundGraphics = vi.fn();
		const panel = createFormatBackgroundPanel(document, t, {
			setSlideBackgroundColor: vi.fn(),
			clearSlideBackground: vi.fn(),
			setHideBackgroundGraphics,
		});
		const checkbox = panel.el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;

		checkbox.checked = true;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));
		expect(setHideBackgroundGraphics).toHaveBeenCalledWith(true);

		checkbox.checked = false;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));
		expect(setHideBackgroundGraphics).toHaveBeenCalledWith(false);
	});
});
