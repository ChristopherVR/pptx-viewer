import { VIEWER_OPTIONS_TABS } from 'pptx-viewer-shared';
import type { ViewerCustomization } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import type { Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../editor/editor-state.svelte';
import { TableCellSelection } from '../editor/table-cell-selection.svelte';
import {
	ViewerCustomizationState,
	customizationContext,
} from '../state/viewer-customization.svelte';
import { ViewerOptionsState } from '../state/viewer-options.svelte';
import CanvasContextMenu from './CanvasContextMenu.svelte';
import ElementContextMenu from './ElementContextMenu.svelte';
import SettingsDialog from './SettingsDialog.svelte';

/**
 * The customisation render sites that are cheapest to exercise directly:
 * the File > Options dialog and the two right-click menus, each mounted under
 * a provided customisation context.
 */
let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountWith<P extends Record<string, unknown>>(
	component: Component<P>,
	props: P,
	customization: ViewerCustomization,
): { target: HTMLElement; state: ViewerCustomizationState } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const state = new ViewerCustomizationState(customization);
	const instance = mount(component, { target, props, context: customizationContext(state) });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
		state.destroy();
	};
	return { target, state };
}

function settingsProps(): Record<string, unknown> {
	return {
		optionsState: new ViewerOptionsState({ persist: false }),
		onclose: vi.fn(),
		themeKey: '',
		themeCatalog: [],
		onsetthemekey: vi.fn(),
		locale: 'en',
		onsetlocale: vi.fn(),
		aiEnabled: true,
	};
}

function navLabels(target: HTMLElement): string[] {
	return Array.from(target.querySelectorAll('nav button')).map((b) => (b.textContent ?? '').trim());
}

describe('settingsDialog customization', () => {
	it('drops a hidden Options page and the AI page when that page is hidden', () => {
		const { target } = mountWith(
			SettingsDialog as unknown as Component<Record<string, unknown>>,
			settingsProps(),
			{ options: { hiddenPages: ['proofing', 'ai'] } },
		);
		expect(navLabels(target)).toHaveLength(VIEWER_OPTIONS_TABS.length - 1);
		expect(navLabels(target)).not.toContain('AI assistant');
	});

	it('removes a hidden setting and renders a locked one disabled', () => {
		const { target } = mountWith(
			SettingsDialog as unknown as Component<Record<string, unknown>>,
			settingsProps(),
			{
				options: {
					hiddenSettings: ['general.userInitials'],
					locked: { 'general.userName': 'Host' },
				},
			},
		);
		const userName = target.querySelector<HTMLInputElement>('input[aria-label="User name"]');
		expect(userName).not.toBeNull();
		expect(userName?.disabled).toBeTruthy();
		expect(userName?.title).toBe('This setting is managed by your organization');
		expect(target.querySelector('input[aria-label="Initials"]')).toBeNull();
	});

	it('falls back to the first visible page when the active page is hidden live', () => {
		const { target, state } = mountWith(
			SettingsDialog as unknown as Component<Record<string, unknown>>,
			settingsProps(),
			{},
		);
		const before = navLabels(target);
		state.api.hideOptionsPage('general');
		flushSync();
		const active = target.querySelector('nav button.active');
		expect(active?.textContent?.trim()).toBe(before[1]);
	});
});

function editorStub(): EditorState {
	return {
		tableCells: new TableCellSelection(),
		clipboardOps: { copySelected: vi.fn(), cutSelected: vi.fn(), pasteClipboard: vi.fn() },
		arrangeOps: { groupSelected: vi.fn(), ungroupSelected: vi.fn() },
		duplicateSelected: vi.fn(),
		reorderSelected: vi.fn(),
		deleteSelected: vi.fn(),
		applyElementPatch: vi.fn(),
		selection: { ids: [] },
		selectedElement: undefined,
		selectedElements: [],
		hasClipboard: true,
		slides: [],
	} as unknown as EditorState;
}

function menuLabels(target: HTMLElement): string[] {
	return Array.from(target.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')).map(
		(item) => (item.textContent ?? '').trim(),
	);
}

describe('context menu customization', () => {
	it('omits a hidden element command and closes when the menu is disabled', () => {
		const onclose = vi.fn();
		const { target, state } = mountWith(
			ElementContextMenu as unknown as Component<Record<string, unknown>>,
			{ x: 10, y: 10, editor: editorStub(), onclose },
			{ contextMenu: { hiddenElementCommands: ['duplicate'] } },
		);
		const labels = menuLabels(target);
		expect(labels).toContain('Copy');
		expect(labels).not.toContain('Duplicate');
		expect(onclose).not.toHaveBeenCalled();

		state.api.updateCustomization({ contextMenu: { disableElementMenu: true } });
		flushSync();
		expect(target.querySelector('[data-pptx-context-menu]')).toBeNull();
		expect(onclose).toHaveBeenCalledWith();
	});

	it('omits a hidden canvas command', () => {
		const { target } = mountWith(
			CanvasContextMenu as unknown as Component<Record<string, unknown>>,
			{ x: 10, y: 10, editor: editorStub(), showGrid: false, showRulers: false, onclose: vi.fn() },
			{ contextMenu: { hiddenCanvasCommands: ['ruler'] } },
		);
		const labels = menuLabels(target);
		expect(labels.length).toBeGreaterThan(0);
		expect(labels.some((label) => /ruler/iu.test(label))).toBeFalsy();
	});
});
