import type { PptxHandler, PptxTheme } from 'pptx-viewer-core';
import { THEME_PRESETS } from 'pptx-viewer-core';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ThemeSection from './ThemeSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

describe('themeSection', () => {
	it('applies presets and enables per-slide color overrides', async () => {
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.editable = true;
		editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
		const theme: PptxTheme = {
			name: 'Office',
			colorScheme: THEME_PRESETS[0].colorScheme,
			fontScheme: THEME_PRESETS[0].fontScheme,
		};
		const switchTheme = vi.fn(async (data, colorScheme, fontScheme, name) => ({
			...data,
			theme: { name, colorScheme, fontScheme },
		}));
		const handler = { switchTheme } as unknown as PptxHandler;
		const onthemechange = vi.fn();
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ThemeSection, {
			target,
			props: { editor, handler, theme, onthemechange },
		});
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		flushSync();
		target.querySelectorAll<HTMLButtonElement>('.presets button')[1]?.click();
		await tick();
		expect(switchTheme).toHaveBeenCalledWith(
			expect.any(Object),
			THEME_PRESETS[1].colorScheme,
			THEME_PRESETS[1].fontScheme,
			THEME_PRESETS[1].name,
		);
		expect(onthemechange).toHaveBeenCalledWith(
			expect.objectContaining({ name: THEME_PRESETS[1].name }),
		);
		const override = Array.from(
			target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
		)[0];
		override?.click();
		flushSync();
		expect(editor.slides[0]?.clrMapOverride?.accent1).toBe('accent1');
	});
});
