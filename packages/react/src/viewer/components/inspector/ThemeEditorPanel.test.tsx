import { PRESET_THEMES } from 'pptx-viewer-shared';
// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeEditorPanel } from './ThemeEditorPanel';

vi.mock(import('react-i18next'), () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const container = document.createElement('div');
const root = createRoot(container);
afterEach(() => act(() => root.render(null)));
const theme = { name: 'Loaded', colorScheme: PRESET_THEMES[0].colorScheme };
describe('theme editor React adapter', () => {
	it('stages edits and applies once through the current callback', async () => {
		const original = vi.fn();
		const current = vi.fn();
		const close = vi.fn();
		act(() =>
			root.render(<ThemeEditorPanel theme={theme} canEdit onApply={original} onClose={close} />),
		);
		const panel = container.querySelector('pptx-ui-theme-editor')!;
		panel.shadowRoot!.querySelectorAll<HTMLButtonElement>('.preset')[1].click();
		expect(original).not.toHaveBeenCalled();
		act(() =>
			root.render(<ThemeEditorPanel theme={theme} canEdit onApply={current} onClose={close} />),
		);
		await act(async () => panel.shadowRoot!.querySelector<HTMLButtonElement>('.apply')!.click());
		expect(current).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'Facet' }));
		expect(original).not.toHaveBeenCalled();
		act(() => panel.shadowRoot!.querySelector<HTMLButtonElement>('.close')!.click());
		expect(close).toHaveBeenCalledOnce();
	});

	it('updates disabled state and removes callbacks on unmount', () => {
		const apply = vi.fn();
		const close = vi.fn();
		act(() =>
			root.render(<ThemeEditorPanel theme={theme} canEdit onApply={apply} onClose={close} />),
		);
		const panel = container.querySelector('pptx-ui-theme-editor')!;
		act(() =>
			root.render(
				<ThemeEditorPanel theme={theme} canEdit={false} onApply={apply} onClose={close} />,
			),
		);
		panel.shadowRoot!.querySelector<HTMLButtonElement>('.apply')!.click();
		expect(apply).not.toHaveBeenCalled();
		act(() => root.render(null));
		panel.dispatchEvent(new CustomEvent('theme-editor-close'));
		expect(close).not.toHaveBeenCalled();
	});
});
