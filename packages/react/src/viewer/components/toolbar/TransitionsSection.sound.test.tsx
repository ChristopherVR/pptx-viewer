// @vitest-environment happy-dom
/**
 * The Transitions ribbon tab's Sound picker: it used to be a permanently
 * `disabled` `<select>` with a single "[No Sound]" entry, because no binding
 * had a way to author a transition sound. It is now wired to the shared
 * `pptx-viewer-shared` decision functions: "Other Sound..." opens a native
 * file picker and a pick writes `soundData` (embedded by the core save
 * pipeline's `embedTransitionSound`); "None" clears any sound the slide
 * carries.
 */
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { TransitionsSection } = await import('./TransitionsSection');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

function renderTab(
	transition: PptxSlideTransition | undefined,
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void,
): void {
	act(() => {
		root.render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
				onApplyTransitionToAll: vi.fn<() => void>(),
				onTransitionChange,
				activeSlide: { id: 's1', elements: [], transition } as unknown as PptxSlide,
			}),
		);
	});
}

function soundSelect(): HTMLSelectElement {
	const select = container.querySelector<HTMLSelectElement>(
		'select[aria-label="pptx.ribbon.sound"]',
	);
	if (!select) {
		throw new Error('no Sound select rendered');
	}
	return select;
}

function soundFileInput(): HTMLInputElement {
	const input = container.querySelector<HTMLInputElement>('input[type="file"]');
	if (!input) {
		throw new Error('no Sound file input rendered');
	}
	return input;
}

/** Poll until `predicate` is true, rather than hoping a fixed delay covers
 * the FileReader read (its completion time is not guaranteed under load). */
async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor: condition not met before deadline');
		}
		await act(async () => {
			await new Promise((resolve) => {
				setTimeout(resolve, 5);
			});
		});
	}
}

describe('transitions > Sound picker', () => {
	it('shows None and Other Sound when the slide has no sound, and is enabled', () => {
		const onTransitionChange = vi.fn();
		renderTab({ type: 'fade' }, onTransitionChange);

		const select = soundSelect();
		expect(select.disabled).toBeFalsy();
		const optionValues = Array.from(select.options).map((o) => o.value);
		expect(optionValues).toStrictEqual(['none', 'other']);
	});

	it('leads with the current file name once the slide carries a sound', () => {
		const onTransitionChange = vi.fn();
		renderTab({ type: 'fade', soundFileName: 'chime.wav' }, onTransitionChange);

		const select = soundSelect();
		expect(select.value).toBe('current');
		expect(Array.from(select.options).map((o) => o.value)).toStrictEqual([
			'current',
			'none',
			'other',
		]);
	});

	it('clears the sound when "None" is chosen', () => {
		const onTransitionChange = vi.fn();
		renderTab({ type: 'fade', soundFileName: 'chime.wav', soundRId: 'rId2' }, onTransitionChange);

		const select = soundSelect();
		act(() => {
			select.value = 'none';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});

		expect(onTransitionChange).toHaveBeenCalledWith(
			expect.objectContaining({ soundRId: undefined, soundFileName: undefined }),
		);
	});

	it('opens the file picker instead of committing when "Other Sound..." is chosen', () => {
		const onTransitionChange = vi.fn();
		renderTab({ type: 'fade' }, onTransitionChange);

		const input = soundFileInput();
		const clickSpy = vi.spyOn(input, 'click');
		const select = soundSelect();
		act(() => {
			select.value = 'other';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});

		expect(clickSpy).toHaveBeenCalledOnce();
		expect(onTransitionChange).not.toHaveBeenCalled();
		// The select falls back to what the slide actually has (no sound).
		expect(select.value).toBe('none');
	});

	it('commits the picked file as pending sound data', async () => {
		const onTransitionChange = vi.fn();
		renderTab({ type: 'fade' }, onTransitionChange);

		const input = soundFileInput();
		const file = new File(['fake wav bytes'], 'applause.wav', { type: 'audio/wav' });
		Object.defineProperty(input, 'files', { value: [file], configurable: true });

		act(() => {
			input.dispatchEvent(new Event('change', { bubbles: true }));
		});
		// FileReader resolves asynchronously even for an in-memory Blob.
		await waitFor(() => onTransitionChange.mock.calls.length > 0);

		expect(onTransitionChange).toHaveBeenCalledWith(
			expect.objectContaining({
				soundFileName: 'applause.wav',
				soundName: 'applause',
				soundRId: undefined,
				soundPath: undefined,
			}),
		);
		const call = onTransitionChange.mock.calls[0][0] as Partial<PptxSlideTransition>;
		expect(call.soundData).toBeTypeOf('string');
		expect(call.soundData).toMatch(/^data:/);
	});
});
