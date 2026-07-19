// @vitest-environment happy-dom
import type { ViewerOptions } from 'pptx-viewer-shared';
import {
	cloneViewerOptions,
	DEFAULT_VIEWER_OPTIONS,
	VIEWER_OPTIONS_TABS,
} from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { SettingsDialog } = await import('./SettingsDialog');
type SettingsDialogProps = import('./SettingsDialog').SettingsDialogProps;

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

function createProps(overrides: Partial<SettingsDialogProps> = {}): SettingsDialogProps {
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

function renderDialog(props: SettingsDialogProps): void {
	act(() => {
		root.render(<SettingsDialog {...props} />);
	});
}

function navButton(labelKey: string): HTMLButtonElement {
	const nav = container.querySelector('nav');
	expect(nav).not.toBeNull();
	const button = Array.from(nav!.querySelectorAll('button')).find(
		(candidate) => candidate.textContent === labelKey,
	);
	expect(button).toBeDefined();
	return button as HTMLButtonElement;
}

describe('settingsDialog', () => {
	it('renders nothing while closed', () => {
		renderDialog(createProps({ isOpen: false }));
		expect(container.innerHTML).toBe('');
	});

	it('renders all ten categories from VIEWER_OPTIONS_TABS', () => {
		renderDialog(createProps());
		expect(VIEWER_OPTIONS_TABS).toHaveLength(10);
		for (const tab of VIEWER_OPTIONS_TABS) {
			expect(navButton(tab.labelKey)).toBeDefined();
		}
	});

	it('switches panes when a category is clicked', () => {
		renderDialog(createProps());
		// General is active initially.
		expect(navButton('pptx.settings.general').getAttribute('aria-current')).toBe('true');
		expect(container.textContent).toContain('pptx.options.general.description');

		act(() => {
			navButton('pptx.options.advanced.label').click();
		});
		expect(navButton('pptx.options.advanced.label').getAttribute('aria-current')).toBe('true');
		expect(navButton('pptx.settings.general').getAttribute('aria-current')).toBe('false');
		expect(container.textContent).toContain('pptx.options.advanced.description');
	});

	it('reports a toggle change through onOptionChange', () => {
		const props = createProps();
		renderDialog(props);
		const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
		expect(checkbox).not.toBeNull();
		act(() => {
			checkbox!.click();
		});
		expect(props.onOptionChange).toHaveBeenCalledOnce();
		const [group, key, value] = vi.mocked(props.onOptionChange).mock.calls[0];
		expect(group).toBe('general');
		expect(key).toBeTypeOf('string');
		expect(value).toBeTypeOf('boolean');
	});

	it('shows the AI section only when aiEnabled is set', () => {
		renderDialog(createProps());
		const aiNav = Array.from(container.querySelectorAll('nav button')).find(
			(b) => b.textContent === 'pptx.ai.settingsSectionTitle',
		);
		expect(aiNav).toBeUndefined();

		renderDialog(createProps({ aiEnabled: true }));
		const aiButton = navButton('pptx.ai.settingsSectionTitle');
		act(() => aiButton.click());
		expect(aiButton.getAttribute('aria-current')).toBe('true');
		expect(container.textContent).toContain('pptx.ai.exportLogsJson');
	});

	it('cancel restores the snapshot taken when the dialog opened', () => {
		const props = createProps();
		renderDialog(props);
		const cancel = Array.from(container.querySelectorAll('button')).find(
			(candidate) => candidate.textContent === 'pptx.common.cancel',
		);
		expect(cancel).toBeDefined();
		act(() => {
			cancel!.click();
		});
		expect(props.onRestoreOptions).toHaveBeenCalledOnce();
		expect(vi.mocked(props.onRestoreOptions).mock.calls[0][0]).toBe(props.options);
		expect(props.onClose).toHaveBeenCalledOnce();
	});
});
