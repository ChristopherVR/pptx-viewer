import { PRESET_THEMES, registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ThemeEditorPanel from './ThemeEditorPanel.svelte';

registerPptxWebControls();
let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});
const theme = {
	name: 'Loaded',
	colorScheme: PRESET_THEMES[0].colorScheme,
	fontScheme: {
		majorFont: { latin: 'Custom Font', eastAsia: 'Yu Gothic' },
		minorFont: { latin: 'Verdana' },
	},
};
function panel(canEdit = true) {
	const target = document.createElement('div');
	document.body.append(target);
	const onapply = vi.fn();
	const onclose = vi.fn();
	const instance = mount(ThemeEditorPanel, { target, props: { theme, canEdit, onapply, onclose } });
	flushSync();
	cleanup = () => {
		void unmount(instance);
		target.remove();
	};
	return { root: target.querySelector('pptx-ui-theme-editor')!.shadowRoot!, onapply, onclose };
}
describe('theme editor Svelte adapter', () => {
	it('stages edits until Apply and retains non-Latin fonts', () => {
		const { root, onapply } = panel();
		expect(root.querySelectorAll('input[type=color]')).toHaveLength(12);
		expect(root.querySelector('pptx-ui-select')!.value).toBe('Custom Font');
		root.querySelectorAll<HTMLButtonElement>('.preset')[1].click();
		expect(onapply).not.toHaveBeenCalled();
		root.querySelector<HTMLButtonElement>('.apply')!.click();
		expect(onapply).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				name: 'Facet',
				fontScheme: expect.objectContaining({
					majorFont: expect.objectContaining({ eastAsia: 'Yu Gothic' }),
				}),
			}),
		);
	});

	it('reset restores the loaded theme without publishing edits', () => {
		const { root, onapply } = panel();
		root.querySelectorAll<HTMLButtonElement>('.preset')[1].click();
		root.querySelectorAll<HTMLButtonElement>('.actions button')[1].click();
		expect(root.querySelector<HTMLInputElement>('input[type=text]')!.value).toBe('Loaded');
		expect(onapply).not.toHaveBeenCalled();
	});

	it('blocks edits in read-only mode while allowing Close', () => {
		const { root, onapply, onclose } = panel(false);
		expect(root.querySelector<HTMLButtonElement>('.apply')!.disabled).toBeTruthy();
		root.querySelector<HTMLButtonElement>('.apply')!.click();
		expect(onapply).not.toHaveBeenCalled();
		root.querySelector<HTMLButtonElement>('.close')!.click();
		expect(onclose).toHaveBeenCalledOnce();
	});
});
