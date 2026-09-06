import { EFFECT_SOUND_CATALOGUE } from 'pptx-viewer-shared';
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

function previewButtonOf(el: HTMLElement): HTMLButtonElement {
	const button = el.querySelector<HTMLButtonElement>('button');
	if (!button) {
		throw new Error('effect sound row has no preview button');
	}
	return button;
}

describe('createEffectSoundRow', () => {
	it('captions the row and defaults to "No Sound"', () => {
		const row = createEffectSoundRow(document, t, vi.fn(), vi.fn());
		expect(row.el.querySelector('span')?.textContent).toBe(t('pptx.animation.sound'));
		row.update({ hasSound: false, editable: true });
		expect(selectOf(row.el).value).toBe('none');
	});

	it('lists all 19 stock sounds plus None and Other Sound', () => {
		const row = createEffectSoundRow(document, t, vi.fn(), vi.fn());
		row.update({ hasSound: false, editable: true });
		const values = Array.from(selectOf(row.el).options).map((o) => o.value);
		expect(values).toStrictEqual(['none', ...EFFECT_SOUND_CATALOGUE.map((e) => e.id), 'other']);
	});

	it('shows the picked custom file name once a non-stock sound is set', () => {
		const row = createEffectSoundRow(document, t, vi.fn(), vi.fn());
		row.update({ hasSound: true, fileName: 'chime.mp3', editable: true });
		const select = selectOf(row.el);
		expect(select.value).toBe('current');
		expect(select.options[1].textContent).toBe('chime.mp3');
	});

	it('shows the matching stock entry selected when catalogueId is set', () => {
		const row = createEffectSoundRow(document, t, vi.fn(), vi.fn());
		row.update({ hasSound: true, fileName: 'CHIMES.WAV', catalogueId: 'chime', editable: true });
		expect(selectOf(row.el).value).toBe('chime');
	});

	it('emits undefined ("No Sound") when the none option is picked', () => {
		const onPick = vi.fn();
		const row = createEffectSoundRow(document, t, onPick, vi.fn());
		row.update({ hasSound: true, fileName: 'chime.mp3', editable: true });
		const select = selectOf(row.el);
		select.value = 'none';
		select.dispatchEvent(new Event('change'));
		expect(onPick).toHaveBeenCalledWith(undefined);
	});

	it('does not emit when "Other Sound..." is picked (opens the file dialog instead)', () => {
		const onPick = vi.fn();
		const row = createEffectSoundRow(document, t, onPick, vi.fn());
		row.update({ hasSound: false, editable: true });
		const select = selectOf(row.el);
		select.value = 'other';
		select.dispatchEvent(new Event('change'));
		expect(onPick).not.toHaveBeenCalled();
	});

	it('calls onPickStock with the catalogue id when a stock entry is picked', () => {
		const onPickStock = vi.fn();
		const row = createEffectSoundRow(document, t, vi.fn(), onPickStock);
		row.update({ hasSound: false, editable: true });
		const select = selectOf(row.el);
		select.value = 'chime';
		select.dispatchEvent(new Event('change'));
		expect(onPickStock).toHaveBeenCalledWith('chime');
	});

	it('stages a picked file as a data: URL', async () => {
		const onPick = vi.fn();
		const row = createEffectSoundRow(document, t, onPick, vi.fn());
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
		const row = createEffectSoundRow(document, t, vi.fn(), vi.fn());
		row.update({ hasSound: false, editable: false });
		expect(selectOf(row.el).disabled).toBeTruthy();
	});

	it('only accepts audio files', () => {
		const row = createEffectSoundRow(document, t, vi.fn(), vi.fn());
		expect(fileInputOf(row.el).accept).toBe('audio/*');
	});

	it('disables the preview button unless a stock sound is selected, and plays it otherwise', () => {
		const row = createEffectSoundRow(document, t, vi.fn(), vi.fn());
		row.update({ hasSound: false, editable: true });
		expect(previewButtonOf(row.el).disabled).toBeTruthy();

		row.update({ hasSound: true, fileName: 'CHIMES.WAV', catalogueId: 'chime', editable: true });
		const button = previewButtonOf(row.el);
		expect(button.disabled).toBeFalsy();
		expect(() => {
			button.dispatchEvent(new Event('click'));
		}).not.toThrow();
	});
});
