import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createEffectSoundRow } from './effect-sound-row';

const t = createTranslator();

function selectOf(el: HTMLElement): HTMLSelectElement {
	const select = el.querySelector('select');
	if (!select) {
		throw new Error('effect sound row has no select');
	}
	return select;
}

function fileInputOf(el: HTMLElement): HTMLInputElement {
	const input = el.querySelector<HTMLInputElement>('input[type="file"]');
	if (!input) {
		throw new Error('effect sound row has no file input');
	}
	return input;
}

describe('createEffectSoundRow', () => {
	it('captions the row and defaults to "No Sound"', () => {
		const row = createEffectSoundRow(document, t, vi.fn());
		expect(row.el.querySelector('span')?.textContent).toBe(t('pptx.animation.sound'));
		row.update({ hasSound: false, editable: true });
		expect(selectOf(row.el).value).toBe('none');
	});

	it('shows the picked file name once a sound is set', () => {
		const row = createEffectSoundRow(document, t, vi.fn());
		row.update({ hasSound: true, fileName: 'chime.mp3', editable: true });
		const select = selectOf(row.el);
		expect(select.value).toBe('custom');
		expect(select.options[1].textContent).toBe('chime.mp3');
	});

	it('emits undefined ("No Sound") when the none option is picked', () => {
		const onPick = vi.fn();
		const row = createEffectSoundRow(document, t, onPick);
		row.update({ hasSound: true, fileName: 'chime.mp3', editable: true });
		const select = selectOf(row.el);
		select.value = 'none';
		select.dispatchEvent(new Event('change'));
		expect(onPick).toHaveBeenCalledWith(undefined);
	});

	it('does not emit when the custom option is picked (opens the file dialog instead)', () => {
		const onPick = vi.fn();
		const row = createEffectSoundRow(document, t, onPick);
		row.update({ hasSound: false, editable: true });
		const select = selectOf(row.el);
		select.value = 'custom';
		select.dispatchEvent(new Event('change'));
		expect(onPick).not.toHaveBeenCalled();
	});

	it('stages a picked file as a data: URL', async () => {
		const onPick = vi.fn();
		const row = createEffectSoundRow(document, t, onPick);
		const input = fileInputOf(row.el);
		const file = new File(['abc'], 'chime.mp3', { type: 'audio/mpeg' });
		Object.defineProperty(input, 'files', { value: [file] });
		input.dispatchEvent(new Event('change'));

		for (let attempt = 0; attempt < 50 && onPick.mock.calls.length === 0; attempt++) {
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
		}

		expect(onPick).toHaveBeenCalledOnce();
		const [pick] = onPick.mock.calls[0];
		expect(pick.fileName).toBe('chime.mp3');
		expect(pick.dataUrl).toMatch(/^data:/u);
	});

	it('disables the select when not editable', () => {
		const row = createEffectSoundRow(document, t, vi.fn());
		row.update({ hasSound: false, editable: false });
		expect(selectOf(row.el).disabled).toBeTruthy();
	});

	it('only accepts audio files', () => {
		const row = createEffectSoundRow(document, t, vi.fn());
		expect(fileInputOf(row.el).accept).toBe('audio/*');
	});
});
