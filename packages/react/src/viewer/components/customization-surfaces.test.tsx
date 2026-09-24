// @vitest-environment happy-dom
/**
 * Host UI customisation at the React render sites that map a shared
 * descriptor: the File > Options dialog (hidden pages / settings, locked
 * settings) and the element context menu (hidden commands, disabled menu).
 * The decisions are `pptx-viewer-shared`'s; these
 * tests pin that React actually renders what they return.
 */
import type { ResolvedCustomization, ViewerCustomization, ViewerOptions } from 'pptx-viewer-shared';
import {
	cloneViewerOptions,
	DEFAULT_VIEWER_OPTIONS,
	resolveCustomization,
} from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { SettingsDialog } = await import('./SettingsDialog');
const { ContextMenu } = await import('./ContextMenu');
const { ViewerCustomizationContext } = await import('./viewer-customization-context');
type SettingsDialogProps = import('./SettingsDialog').SettingsDialogProps;
type ContextMenuProps = import('./context-menu-types').ContextMenuProps;

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

function renderWith(customization: ViewerCustomization, node: React.ReactElement): void {
	const resolved: ResolvedCustomization = resolveCustomization(customization);
	act(() => {
		root.render(
			<ViewerCustomizationContext.Provider value={resolved}>
				{node}
			</ViewerCustomizationContext.Provider>,
		);
	});
}

function dialogProps(overrides: Partial<SettingsDialogProps> = {}): SettingsDialogProps {
	return {
		isOpen: true,
		onClose: vi.fn<() => void>(),
		options: cloneViewerOptions(DEFAULT_VIEWER_OPTIONS),
		onOptionChange: vi.fn<SettingsDialogProps['onOptionChange']>(),
		onRestoreOptions: vi.fn<(options: ViewerOptions) => void>(),
		onRibbonTabHiddenChange: vi.fn<SettingsDialogProps['onRibbonTabHiddenChange']>(),
		onQuickAccessCommandsChange: vi.fn<(commandIds: string[]) => void>(),
		onResetOptions: vi.fn<SettingsDialogProps['onResetOptions']>(),
		onClearCache: vi.fn<() => void>(),
		themeKey: 'default',
		availableThemes: [],
		onSelectTheme: vi.fn<(key: string) => void>(),
		localeCode: 'en',
		availableLocales: [{ code: 'en', label: 'English', nativeLabel: 'English' }],
		onSelectLocale: vi.fn<(code: string) => void>(),
		...overrides,
	};
}

function navLabels(): string[] {
	return Array.from(container.querySelectorAll('nav button')).map((b) => b.textContent ?? '');
}

describe('file > Options customisation', () => {
	it('drops a hidden page from the rail and falls back to the first visible one', () => {
		renderWith(
			{ options: { hiddenPages: ['general', 'save'] } },
			<SettingsDialog {...dialogProps()} />,
		);
		expect(navLabels()).not.toContain('pptx.settings.general');
		expect(navLabels()).toContain('pptx.options.advanced.label');
		const current = container.querySelector('nav button[aria-current="true"]');
		expect(current?.textContent).toBe(navLabels()[0]);
	});

	it('hides the AI page when the host hid it, even with an assistant configured', () => {
		renderWith({}, <SettingsDialog {...dialogProps({ aiEnabled: true })} />);
		expect(navLabels()).toContain('pptx.ai.settingsSectionTitle');
		renderWith(
			{ options: { hiddenPages: ['ai'] } },
			<SettingsDialog {...dialogProps({ aiEnabled: true })} />,
		);
		expect(navLabels()).not.toContain('pptx.ai.settingsSectionTitle');
	});

	it('removes a hidden setting and renders a locked one disabled and inert', () => {
		const props = dialogProps();
		renderWith(
			{
				options: {
					hiddenSettings: ['general.userInitials'],
					locked: { 'general.userName': 'Host User' },
				},
			},
			<SettingsDialog {...props} />,
		);
		expect(
			container.querySelector('input[aria-label="pptx.options.general.userInitials"]'),
		).toBeNull();
		const userName = container.querySelector<HTMLInputElement>(
			'input[aria-label="pptx.options.general.userName"]',
		);
		expect(userName).not.toBeNull();
		expect(userName?.disabled).toBeTruthy();
		expect(userName?.title).toBe('pptx.options.lockedByHost');
		// An unlocked sibling stays enabled.
		const select = container.querySelector(
			'pptx-ui-select[aria-label="pptx.options.general.displayOptimization"]',
		);
		expect(select?.hasAttribute('disabled')).toBeFalsy();
		expect(props.onOptionChange).not.toHaveBeenCalled();
	});
});

function menuProps(): ContextMenuProps {
	return {
		contextMenuState: { x: 40, y: 60, elementId: 'sp_1' },
		mode: 'edit',
		selectedElement: null,
		tableEditorState: null,
		onAction: vi.fn(),
		onInsertTableRow: vi.fn(),
		onDeleteTableRow: vi.fn(),
		onInsertTableColumn: vi.fn(),
		onDeleteTableColumn: vi.fn(),
		onClose: vi.fn(),
	};
}

function menuLabels(): string[] {
	return Array.from(container.querySelectorAll('[data-pptx-context-menu="true"] button')).map(
		(button) => button.textContent ?? '',
	);
}

describe('element context menu customisation', () => {
	it('omits a hidden command and keeps the rest', () => {
		renderWith({}, <ContextMenu {...menuProps()} />);
		expect(menuLabels()).toContain('pptx.contextMenu.delete');
		const before = menuLabels().length;
		renderWith(
			{ contextMenu: { hiddenElementCommands: ['delete'] } },
			<ContextMenu {...menuProps()} />,
		);
		expect(menuLabels()).not.toContain('pptx.contextMenu.delete');
		expect(menuLabels()).toHaveLength(before - 1);
	});

	it('renders nothing when the host disabled the menu', () => {
		renderWith({ contextMenu: { disableElementMenu: true } }, <ContextMenu {...menuProps()} />);
		expect(container.querySelector('[data-pptx-context-menu="true"]')).toBeNull();
		expect(container.innerHTML).toBe('');
	});
});
