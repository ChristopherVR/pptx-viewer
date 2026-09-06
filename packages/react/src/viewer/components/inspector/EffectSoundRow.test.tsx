// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EffectSoundRow } from './EffectSoundRow';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function fireChange(el: HTMLSelectElement | HTMLInputElement): void {
	el.dispatchEvent(new Event('change', { bubbles: true }));
}

function fireClick(el: HTMLElement): void {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('effectSoundRow', () => {
	it('shows "No Sound" selected when the effect has no sound', () => {
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: false }}
					canEdit
					onPick={() => undefined}
					onPickStock={() => undefined}
				/>,
			);
		});
		const select = container.querySelector('select')!;
		expect(select.value).toBe('none');
	});

	it('lists all 19 stock sounds plus None and Other Sound', () => {
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: false }}
					canEdit
					onPick={() => undefined}
					onPickStock={() => undefined}
				/>,
			);
		});
		const select = container.querySelector('select')!;
		// none + 19 stock entries + other = 21
		expect(select.options).toHaveLength(21);
		expect(select.textContent).toContain('pptx.animation.sound.chime');
		expect(select.textContent).toContain('pptx.animation.sound.other');
	});

	it('shows the picked custom file name when a non-stock sound is set', () => {
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: true, fileName: 'chime.mp3' }}
					canEdit
					onPick={() => undefined}
					onPickStock={() => undefined}
				/>,
			);
		});
		const select = container.querySelector('select')!;
		expect(select.value).toBe('current');
		expect(select.textContent).toContain('chime.mp3');
	});

	it('shows the matching stock entry selected when catalogueId is set', () => {
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: true, fileName: 'CHIMES.WAV', catalogueId: 'chime' }}
					canEdit
					onPick={() => undefined}
					onPickStock={() => undefined}
				/>,
			);
		});
		const select = container.querySelector('select')!;
		expect(select.value).toBe('chime');
	});

	it('calls onPick(undefined) when the user picks "No Sound"', () => {
		const onPick = vi.fn();
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: true, fileName: 'chime.mp3' }}
					canEdit
					onPick={onPick}
					onPickStock={() => undefined}
				/>,
			);
		});
		const select = container.querySelector('select')!;
		act(() => {
			select.value = 'none';
			fireChange(select);
		});
		expect(onPick).toHaveBeenCalledWith(undefined);
	});

	it('calls onPickStock with the catalogue id when a stock entry is chosen', () => {
		const onPickStock = vi.fn();
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: false }}
					canEdit
					onPick={() => undefined}
					onPickStock={onPickStock}
				/>,
			);
		});
		const select = container.querySelector('select')!;
		act(() => {
			select.value = 'chime';
			fireChange(select);
		});
		expect(onPickStock).toHaveBeenCalledWith('chime');
	});

	it('opens the hidden file input when "Other Sound..." is chosen', () => {
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: false }}
					canEdit
					onPick={() => undefined}
					onPickStock={() => undefined}
				/>,
			);
		});
		const select = container.querySelector('select')!;
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const clickSpy = vi.spyOn(fileInput, 'click');
		act(() => {
			select.value = 'other';
			fireChange(select);
		});
		expect(clickSpy).toHaveBeenCalledOnce();
	});

	it('disables the select when canEdit is false', () => {
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: false }}
					canEdit={false}
					onPick={() => undefined}
					onPickStock={() => undefined}
				/>,
			);
		});
		const select = container.querySelector('select')!;
		expect(select.disabled).toBeTruthy();
	});

	it('disables the preview button unless a stock sound is selected', () => {
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: false }}
					canEdit
					onPick={() => undefined}
					onPickStock={() => undefined}
				/>,
			);
		});
		const previewButton = container.querySelector('button')!;
		expect(previewButton.disabled).toBeTruthy();
	});

	it('enables and plays the preview button for a selected stock sound', () => {
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: true, fileName: 'CHIMES.WAV', catalogueId: 'chime' }}
					canEdit
					onPick={() => undefined}
					onPickStock={() => undefined}
				/>,
			);
		});
		const previewButton = container.querySelector('button')!;
		expect(previewButton.disabled).toBeFalsy();
		// Playing relies on HTMLMediaElement.play(), unimplemented in happy-dom;
		// clicking must not throw.
		expect(() => {
			act(() => {
				fireClick(previewButton);
			});
		}).not.toThrow();
	});

	it('stages a picked file as a data: URL via the hidden file input', async () => {
		const onPick = vi.fn();
		act(() => {
			root.render(
				<EffectSoundRow
					soundState={{ hasSound: false }}
					canEdit
					onPick={onPick}
					onPickStock={() => undefined}
				/>,
			);
		});
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(['abc'], 'chime.mp3', { type: 'audio/mpeg' });
		Object.defineProperty(fileInput, 'files', { value: [file] });

		await act(async () => {
			fireChange(fileInput);
			// FileReader.onload resolves asynchronously even for small blobs; how many
			// event-loop ticks it takes varies by React major version's test scheduling,
			// so poll instead of assuming a single microtask/macrotask tick suffices.
			const deadline = Date.now() + 5000;
			while (onPick.mock.calls.length === 0 && Date.now() < deadline) {
				await new Promise<void>((resolve) => {
					setTimeout(resolve, 5);
				});
			}
		});

		expect(onPick).toHaveBeenCalledOnce();
		const [pick] = onPick.mock.calls[0];
		expect(pick.fileName).toBe('chime.mp3');
		expect(pick.dataUrl).toMatch(/^data:/u);
	});
});
