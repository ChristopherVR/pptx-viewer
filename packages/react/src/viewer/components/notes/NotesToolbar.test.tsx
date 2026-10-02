// @vitest-environment happy-dom
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { NotesToolbar } from './NotesToolbar';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => translationsEn[key] ?? key }),
}));

beforeAll(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	registerPptxWebControls();
});

const mounted: { root: Root; target: HTMLElement }[] = [];
afterEach(() => {
	for (const { root, target } of mounted.splice(0)) {
		act(() => root.unmount());
		target.remove();
	}
});

function open(overrides: Partial<React.ComponentProps<typeof NotesToolbar>> = {}) {
	const handlers = {
		onApplyRichCommand: vi.fn(),
		onToggleBulletList: vi.fn(),
		onToggleNumberedList: vi.fn(),
		onIndent: vi.fn(),
		onOutdent: vi.fn(),
		onInsertLink: vi.fn(),
		onPrintClick: vi.fn(),
		onToggleRichEdit: vi.fn(),
	};
	const target = document.createElement('div');
	document.body.append(target);
	const root = createRoot(target);
	mounted.push({ root, target });
	act(() =>
		root.render(<NotesToolbar isRichEditEnabled hasAllSlides {...handlers} {...overrides} />),
	);
	const shadow = target.querySelector('pptx-ui-notes-toolbar')!.shadowRoot!;
	const button = (name: string) =>
		shadow.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
	return { handlers, shadow, button };
}

describe('react NotesToolbar adapter', () => {
	it('routes every shared intent to its native editor handler', () => {
		const { handlers, button, shadow } = open();
		act(() => button('Bold')!.click());
		expect(handlers.onApplyRichCommand).toHaveBeenCalledWith('bold');
		act(() => button('Strikethrough')!.click());
		expect(handlers.onApplyRichCommand).toHaveBeenLastCalledWith('strikeThrough');
		act(() => button('Bullet list')!.click());
		act(() => button('Numbered list')!.click());
		act(() => button('Increase indent')!.click());
		act(() => button('Decrease indent')!.click());
		act(() => button('Print notes')!.click());
		act(() => shadow.querySelector<HTMLButtonElement>('.mode')!.click());
		expect(handlers.onToggleBulletList).toHaveBeenCalledOnce();
		expect(handlers.onToggleNumberedList).toHaveBeenCalledOnce();
		expect(handlers.onIndent).toHaveBeenCalledOnce();
		expect(handlers.onOutdent).toHaveBeenCalledOnce();
		expect(handlers.onPrintClick).toHaveBeenCalledOnce();
		expect(handlers.onToggleRichEdit).toHaveBeenCalledOnce();
	});

	it('inserts a link from the in-toolbar popover', () => {
		const { handlers, button, shadow } = open();
		act(() => button('Insert link')!.click());
		const popover = shadow.querySelector<HTMLElement>('.popover')!;
		expect(popover.hidden).toBeFalsy();
		popover.querySelector<HTMLInputElement>('input[name="url"]')!.value = 'example.com';
		act(() => {
			popover.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		});
		expect(handlers.onInsertLink).toHaveBeenCalledExactlyOnceWith(
			'https://example.com',
			'https://example.com',
		);
	});

	it('gates print and formatting from the panel state', () => {
		const { button, shadow } = open({ isRichEditEnabled: false, hasAllSlides: false });
		expect(button('Bold')!.disabled).toBeTruthy();
		expect(button('Print notes')!.hidden).toBeTruthy();
		expect(shadow.querySelector('.mode')!.textContent).toBe('Rich editor');
	});
});
