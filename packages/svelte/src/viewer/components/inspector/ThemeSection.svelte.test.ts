import type { PptxHandler, PptxTheme } from 'pptx-viewer-core';
import { THEME_COLOR_SCHEME_KEYS, THEME_PRESETS } from 'pptx-viewer-core';
import { PRESET_THEMES, THEME_COLOR_SLOT_LABEL_KEYS } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ThemeSection from './ThemeSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

interface ThemeHandlerMock {
	handler: PptxHandler;
	switchTheme: ReturnType<typeof vi.fn>;
	updateThemeColorScheme: ReturnType<typeof vi.fn>;
	updateThemeFontScheme: ReturnType<typeof vi.fn>;
	updateThemeName: ReturnType<typeof vi.fn>;
}

function makeHandler(): ThemeHandlerMock {
	const switchTheme = vi.fn(async (data, colorScheme, fontScheme, name) => ({
		...data,
		theme: { name, colorScheme, fontScheme },
	}));
	const updateThemeColorScheme = vi.fn(async () => undefined);
	const updateThemeFontScheme = vi.fn(async () => undefined);
	const updateThemeName = vi.fn(async () => undefined);
	return {
		handler: {
			switchTheme,
			updateThemeColorScheme,
			updateThemeFontScheme,
			updateThemeName,
		} as unknown as PptxHandler,
		switchTheme,
		updateThemeColorScheme,
		updateThemeFontScheme,
		updateThemeName,
	};
}

function mountSection(mock: ThemeHandlerMock): {
	target: HTMLElement;
	editor: EditorState;
	onthemechange: ReturnType<typeof vi.fn>;
} {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	const theme: PptxTheme = {
		name: 'Office',
		colorScheme: THEME_PRESETS[0].colorScheme,
		fontScheme: THEME_PRESETS[0].fontScheme,
	};
	const onthemechange = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ThemeSection, {
		target,
		props: { editor, handler: mock.handler, theme, onthemechange },
	});
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	flushSync();
	return { target, editor, onthemechange };
}

describe('themeSection', () => {
	it('enables the per-slide colour-map override', () => {
		const mock = makeHandler();
		const { target, editor } = mountSection(mock);

		const override = target.querySelector<HTMLInputElement>('input[type="checkbox"]');
		override?.click();
		flushSync();

		expect(editor.slides[0]?.clrMapOverride?.accent1).toBe('accent1');
	});

	it('spells the colour-map target slots instead of printing dk1 / folHlink', () => {
		const mock = makeHandler();
		const { target } = mountSection(mock);

		target.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
		flushSync();

		const select = target.querySelector<HTMLSelectElement>('.aliases select');
		if (!select) {
			throw new Error('alias override select missing');
		}
		const options = Array.from(select.options);
		// The value set is the parity contract with the other bindings: only the
		// spelling moved.
		expect(options.map((option) => option.value)).toStrictEqual([...THEME_COLOR_SCHEME_KEYS]);
		expect(options.map((option) => option.textContent?.trim())).toStrictEqual(
			THEME_COLOR_SCHEME_KEYS.map((slot) => translationsEn[THEME_COLOR_SLOT_LABEL_KEYS[slot]]),
		);
	});

	it('keeps the raw alias as each override row caption (its accessible name)', () => {
		const mock = makeHandler();
		const { target } = mountSection(mock);

		target.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
		flushSync();

		const captions = Array.from(target.querySelectorAll('.aliases label')).map((label) =>
			Array.from(label.childNodes)
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent ?? '')
				.join('')
				.trim(),
		);
		expect(captions).toContain('bg1');
		expect(captions).toContain('folHlink');
	});

	it('hosts the theme editor panel with the shared preset gallery', () => {
		const mock = makeHandler();
		const { target } = mountSection(mock);

		expect(target.querySelector('.pptx-svelte-theme-editor')).not.toBeNull();
		const presets = target.querySelectorAll('.pptx-svelte-theme-presets button');
		expect(presets).toHaveLength(PRESET_THEMES.length);
	});

	it('takes the cheap in-place path for a preset (not the full switchTheme round-trip)', async () => {
		const mock = makeHandler();
		const { target, onthemechange } = mountSection(mock);

		target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-theme-presets button')[1]?.click();
		await tick();

		expect(mock.updateThemeColorScheme).toHaveBeenCalledWith(PRESET_THEMES[1].colorScheme);
		expect(mock.updateThemeFontScheme).toHaveBeenCalledWith({
			majorFont: { latin: PRESET_THEMES[1].majorFont },
			minorFont: { latin: PRESET_THEMES[1].minorFont },
		});
		expect(mock.updateThemeName).toHaveBeenCalledWith(PRESET_THEMES[1].name);
		// A colour-picker drag must never trigger the heavy whole-deck rebuild.
		expect(mock.switchTheme).not.toHaveBeenCalled();
		expect(onthemechange).toHaveBeenCalledWith(
			expect.objectContaining({ colorScheme: PRESET_THEMES[1].colorScheme }),
		);
	});

	it('runs the full switchTheme only from Apply to Presentation', async () => {
		const mock = makeHandler();
		const { target } = mountSection(mock);

		const apply = Array.from(
			target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-theme-actions button'),
		)[0];
		apply?.click();
		await tick();

		expect(mock.switchTheme).toHaveBeenCalledOnce();
	});
});
