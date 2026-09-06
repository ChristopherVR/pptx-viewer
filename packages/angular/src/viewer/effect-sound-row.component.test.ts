/**
 * The animation panel's effect sound row, Angular binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals, and handlers are called with real
 * DOM elements.
 *
 * Reference binding: packages/react/src/viewer/components/inspector/EffectSoundRow.tsx
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { EFFECT_SOUND_CATALOGUE } from '../internal/shared';
import type { EffectSoundState } from '../internal/shared';
import { EffectSoundRowComponent } from './effect-sound-row.component';
import type { EffectSoundPick } from './effect-sound-row.component';

const ROW_SOURCE = readFileSync(path.join(__dirname, 'effect-sound-row.component.ts'), 'utf8');

function createRow(soundState: EffectSoundState): {
	row: EffectSoundRowComponent;
	emitted: Array<EffectSoundPick | undefined>;
	emittedStock: string[];
} {
	const row = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new EffectSoundRowComponent(),
	);
	Object.assign(row, {
		soundState: signal(soundState) as unknown as InputSignal<EffectSoundState>,
		canEdit: signal(true) as unknown as InputSignal<boolean>,
	});
	const emitted: Array<EffectSoundPick | undefined> = [];
	vi.spyOn(row.pick as OutputEmitterRef<EffectSoundPick | undefined>, 'emit').mockImplementation(
		(value) => {
			emitted.push(value);
		},
	);
	const emittedStock: string[] = [];
	vi.spyOn(row.pickStock as OutputEmitterRef<string>, 'emit').mockImplementation((value) => {
		emittedStock.push(value);
	});
	return { row, emitted, emittedStock };
}

function selectChange(row: EffectSoundRowComponent, value: string): void {
	const select = document.createElement('select');
	const option = document.createElement('option');
	option.value = value;
	select.append(option);
	select.value = value;
	(row as unknown as { onSelect: (event: Event) => void }).onSelect({ target: select } as Event);
}

describe('effectSoundRowComponent', () => {
	it('emits undefined ("No Sound") when the none option is picked', () => {
		const { row, emitted } = createRow({ hasSound: true, fileName: 'x.mp3' });
		selectChange(row, 'none');
		expect(emitted).toStrictEqual([undefined]);
	});

	it('does not emit when "Other Sound..." is picked (opens the file dialog instead)', () => {
		const { row, emitted } = createRow({ hasSound: false });
		selectChange(row, 'other');
		expect(emitted).toStrictEqual([]);
	});

	it('emits pickStock with the catalogue id when a stock entry is picked', () => {
		const { row, emittedStock } = createRow({ hasSound: false });
		selectChange(row, 'chime');
		expect(emittedStock).toStrictEqual(['chime']);
	});

	it('emits a data: URL pick when a file is chosen', async () => {
		const { row, emitted } = createRow({ hasSound: false });
		const input = document.createElement('input');
		input.type = 'file';
		const file = new File(['abc'], 'chime.mp3', { type: 'audio/mpeg' });
		Object.defineProperty(input, 'files', { value: [file] });
		(row as unknown as { onFileChange: (event: Event) => void }).onFileChange({
			target: input,
		} as unknown as Event);

		for (let attempt = 0; attempt < 50 && emitted.length === 0; attempt++) {
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
		}

		expect(emitted).toHaveLength(1);
		expect(emitted[0]?.fileName).toBe('chime.mp3');
		expect(emitted[0]?.dataUrl).toMatch(/^data:/u);
	});

	it('ignores a change event with no file selected', () => {
		const { row, emitted } = createRow({ hasSound: false });
		const input = document.createElement('input');
		input.type = 'file';
		(row as unknown as { onFileChange: (event: Event) => void }).onFileChange({
			target: input,
		} as unknown as Event);
		expect(emitted).toStrictEqual([]);
	});

	it('selectedValue reflects the matching catalogue entry', () => {
		const { row } = createRow({ hasSound: true, fileName: 'CHIMES.WAV', catalogueId: 'chime' });
		expect((row as unknown as { selectedValue: () => string }).selectedValue()).toBe('chime');
	});

	it('onPreview does nothing without a catalogueId, and does not throw with one', () => {
		const { row: noStock } = createRow({ hasSound: false });
		expect(() => {
			(noStock as unknown as { onPreview: () => void }).onPreview();
		}).not.toThrow();

		const { row: withStock } = createRow({
			hasSound: true,
			fileName: 'CHIMES.WAV',
			catalogueId: 'chime',
		});
		expect(() => {
			(withStock as unknown as { onPreview: () => void }).onPreview();
		}).not.toThrow();
	});
});

describe('effect sound row template contract', () => {
	it('labels the row and its built-in options from the shared dictionary', () => {
		expect(ROW_SOURCE).toContain(`'pptx.animation.sound' | translate`);
		expect(ROW_SOURCE).toContain(`'pptx.animation.sound.none' | translate`);
		expect(ROW_SOURCE).toContain(`'pptx.animation.sound.custom' | translate`);
		expect(ROW_SOURCE).toContain(`'pptx.animation.sound.other' | translate`);
		expect(ROW_SOURCE).toContain(`'pptx.animation.sound.preview' | translate`);
	});

	it('renders every catalogue entry via the shared gallery', () => {
		expect(ROW_SOURCE).toContain('EFFECT_SOUND_CATALOGUE');
		expect(EFFECT_SOUND_CATALOGUE).toHaveLength(19);
	});

	it('disables the select on a read-only deck', () => {
		expect(ROW_SOURCE).toContain('[disabled]="!canEdit()"');
	});

	it('accepts only audio files', () => {
		expect(ROW_SOURCE).toContain('accept="audio/*"');
	});
});
