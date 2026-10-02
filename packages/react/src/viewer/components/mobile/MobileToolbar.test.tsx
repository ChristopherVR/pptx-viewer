// @vitest-environment happy-dom
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ToolbarProps } from '../toolbar/toolbar-types';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => translationsEn[key] ?? key }),
}));
vi.mock<typeof import('./MobileMenuSheet')>(import('./MobileMenuSheet'), () => ({
	MobileMenuSheet: ({ open }: { open: boolean }) => (
		<div data-testid='menu-sheet' data-open={open} />
	),
}));

const { MobileToolbar } = await import('./MobileToolbar');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function render(overrides: Partial<ToolbarProps> = {}) {
	const props = {
		mode: 'edit',
		canUndo: true,
		canRedo: false,
		onUndo: vi.fn(),
		onRedo: vi.fn(),
		onSetMode: vi.fn(),
		onSaveAsPptx: vi.fn(),
		onOpenShareDialog: vi.fn(),
		...overrides,
	} as unknown as ToolbarProps;
	act(() => root.render(<MobileToolbar {...props} />));
	const host = container.querySelector('pptx-ui-mobile-toolbar')!;
	const button = (name: string) =>
		host.shadowRoot!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
	return { props, button };
}

describe('mobileToolbar adapter', () => {
	it('routes the controls to their handlers and opens the menu sheet', () => {
		const { props, button } = render();
		for (const name of ['Undo', 'Save', 'Present', 'Share']) {
			act(() => button(name).click());
		}
		expect(props.onUndo).toHaveBeenCalledOnce();
		expect(props.onSaveAsPptx).toHaveBeenCalledOnce();
		expect(props.onSetMode).toHaveBeenCalledWith('present');
		expect(props.onOpenShareDialog).toHaveBeenCalledOnce();
		act(() => button('Menu').click());
		expect(container.querySelector('[data-testid="menu-sheet"]')?.getAttribute('data-open')).toBe(
			'true',
		);
	});

	it('gates by mode, history state and hiddenActions', () => {
		const { button } = render({ hiddenActions: ['share', 'fullscreen'] });
		expect(button('Redo').disabled).toBeTruthy();
		expect(button('Share').hidden).toBeTruthy();
		expect(button('Present').hidden).toBeTruthy();
		const view = render({ mode: 'view' });
		expect(view.button('Undo').hidden).toBeTruthy();
		expect(view.button('Save').hidden).toBeFalsy();
	});
});
