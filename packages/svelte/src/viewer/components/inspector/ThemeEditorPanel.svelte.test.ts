import type { PptxTheme } from 'pptx-viewer-core';
import { THEME_COLOR_SCHEME_KEYS } from 'pptx-viewer-core';
import { COMMON_FONTS, PRESET_THEMES } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ThemeEditorPanel from './ThemeEditorPanel.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const loadedTheme: PptxTheme = {
	name: 'From File',
	colorScheme: { ...PRESET_THEMES[0].colorScheme, accent1: '#123456' },
	fontScheme: { majorFont: { latin: 'Georgia' }, minorFont: { latin: 'Verdana' } },
};

interface Handlers {
	onupdatecolorscheme: ReturnType<typeof vi.fn>;
	onupdatefontscheme: ReturnType<typeof vi.fn>;
	onupdatename: ReturnType<typeof vi.fn>;
	onapply: ReturnType<typeof vi.fn>;
}

function mountPanel(
	theme: PptxTheme | undefined = loadedTheme,
	canEdit = true,
): { target: HTMLElement; handlers: Handlers } {
	const handlers: Handlers = {
		onupdatecolorscheme: vi.fn(),
		onupdatefontscheme: vi.fn(),
		onupdatename: vi.fn(),
		onapply: vi.fn(),
	};
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ThemeEditorPanel, { target, props: { theme, canEdit, ...handlers } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, handlers };
}

describe('themeEditorPanel', () => {
	it('seeds the name, colours and fonts from the loaded theme', () => {
		const { target } = mountPanel();

		const name = target.querySelector<HTMLInputElement>('.pptx-svelte-theme-field input')!;
		expect(name.value).toBe('From File');
		const selects = Array.from(target.querySelectorAll<HTMLSelectElement>('select'));
		expect(selects[0].value).toBe('Georgia');
		expect(selects[1].value).toBe('Verdana');
	});

	it('renders one swatch per scheme slot and one button per shared preset', () => {
		const { target } = mountPanel();

		expect(target.querySelectorAll('.pptx-svelte-theme-swatch')).toHaveLength(
			THEME_COLOR_SCHEME_KEYS.length,
		);
		expect(target.querySelectorAll('.pptx-svelte-theme-presets button')).toHaveLength(
			PRESET_THEMES.length,
		);
	});

	it('applies a preset colour scheme, font pair and name in one click', () => {
		const { target, handlers } = mountPanel();

		target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-theme-presets button')[2]?.click();
		flushSync();

		expect(handlers.onupdatecolorscheme).toHaveBeenCalledWith(PRESET_THEMES[2].colorScheme);
		expect(handlers.onupdatefontscheme).toHaveBeenCalledWith({
			majorFont: { latin: PRESET_THEMES[2].majorFont },
			minorFont: { latin: PRESET_THEMES[2].minorFont },
		});
		expect(handlers.onupdatename).toHaveBeenCalledWith(PRESET_THEMES[2].name);
	});

	it('opens an inline picker for the clicked slot and pushes the colour out', () => {
		const { target, handlers } = mountPanel();

		expect(target.querySelector('.pptx-svelte-theme-picker')).toBeNull();
		target.querySelector<HTMLButtonElement>('.pptx-svelte-theme-swatch button')?.click();
		flushSync();

		const picker = target.querySelector<HTMLInputElement>(
			'.pptx-svelte-theme-picker input[type="color"]',
		);
		expect(picker).not.toBeNull();
		picker!.value = '#ff0000';
		picker!.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		const scheme = handlers.onupdatecolorscheme.mock.calls.at(-1)?.[0] as Record<string, string>;
		expect(scheme[THEME_COLOR_SCHEME_KEYS[0]]).toBe('#ff0000');
	});

	it('accepts a typed hex only once it is a complete value', () => {
		const { target, handlers } = mountPanel();

		target.querySelector<HTMLButtonElement>('.pptx-svelte-theme-swatch button')?.click();
		flushSync();
		const hex = target.querySelector<HTMLInputElement>(
			'.pptx-svelte-theme-picker input[type="text"]',
		)!;

		hex.value = '#12';
		hex.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect(handlers.onupdatecolorscheme).not.toHaveBeenCalled();

		hex.value = '#00ff00';
		hex.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect(handlers.onupdatecolorscheme).toHaveBeenCalledWith(
			expect.objectContaining({ [THEME_COLOR_SCHEME_KEYS[0]]: '#00ff00' }),
		);
	});

	it('restores the theme as loaded when Reset is pressed after edits', () => {
		const { target, handlers } = mountPanel();

		target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-theme-presets button')[1]?.click();
		flushSync();
		const reset = Array.from(
			target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-theme-actions button'),
		)[1];
		reset.click();
		flushSync();

		expect(handlers.onupdatecolorscheme).toHaveBeenLastCalledWith(loadedTheme.colorScheme);
		expect(handlers.onupdatename).toHaveBeenLastCalledWith('From File');
		expect(handlers.onupdatefontscheme).toHaveBeenLastCalledWith({
			majorFont: { latin: 'Georgia' },
			minorFont: { latin: 'Verdana' },
		});
	});

	it('keeps a theme font that is not in the curated list selectable', () => {
		// A real deck can name any installed font; dropping it from the select
		// would silently rewrite the theme to whatever happened to be first.
		const exotic: PptxTheme = {
			...loadedTheme,
			fontScheme: { majorFont: { latin: 'Bodoni MT Poster' }, minorFont: { latin: 'Verdana' } },
		};
		const { target } = mountPanel(exotic);
		const heading = target.querySelectorAll<HTMLSelectElement>('select')[0];
		const headingOptions = Array.from(heading.options).map((option) => option.value);

		expect(heading.value).toBe('Bodoni MT Poster');
		expect(headingOptions[0]).toBe('Bodoni MT Poster');
		expect(headingOptions).toHaveLength(COMMON_FONTS.length + 1);
	});

	it('raises Apply to Presentation without touching the working copy', () => {
		const { target, handlers } = mountPanel();

		Array.from(
			target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-theme-actions button'),
		)[0].click();
		flushSync();

		expect(handlers.onapply).toHaveBeenCalledOnce();
		expect(handlers.onupdatecolorscheme).not.toHaveBeenCalled();
	});

	it('disables every control in a read-only viewer', () => {
		const { target } = mountPanel(loadedTheme, false);

		const controls = Array.from(
			target.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(
				'button, input, select',
			),
		);
		expect(controls.every((control) => control.disabled)).toBeTruthy();
	});
});
