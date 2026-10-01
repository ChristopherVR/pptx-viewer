import { DEFAULT_VIEWER_PREFERENCES, registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ViewTab from './ViewTab.svelte';

registerPptxWebControls();

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountTab(overrides: Record<string, unknown> = {}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	const noop = vi.fn();
	const instance = mount(ViewTab, {
		target,
		props: {
			editor,
			preferences: DEFAULT_VIEWER_PREFERENCES,
			onpreferenceschange: noop,
			onzoomfit: noop,
			onselectionpane: noop,
			onslidesorter: noop,
			showGuides: false,
			onshowguideschange: noop,
			snapToShape: false,
			onsnapToShapechange: noop,
			onaddguide: noop,
			...overrides,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function button(target: HTMLElement, id: string): HTMLButtonElement {
	return target
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}

describe('viewTab', () => {
	it('disables editing commands when the editor is read-only', () => {
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.editable = false;
		const target = mountTab({ editor });
		for (const id of [
			'view.show.eyedropper',
			'view.masterViews.slideMaster',
			'view.window.templateEditing',
		]) {
			expect(button(target, id).disabled).toBeTruthy();
		}
		expect(target.querySelector('[data-testid="template-edit-toggle"]')).toBe(
			target.querySelector('[data-ribbon-control="view.window.templateEditing"]'),
		);
	});

	it('offers the presentation-view, master-view, zoom and window commands in order', () => {
		const target = mountTab();
		// `e2e/ribbon-control-inventory.spec.ts` diffs every binding against React
		// by accessible name, so the Presentation Views order is a contract.
		const commands = [
			...target.querySelectorAll(
				'[data-ribbon-group="view.presentationViews"] pptx-ui-ribbon-command',
			),
		];
		expect(commands.map((el) => el.getAttribute('label'))).toStrictEqual([
			'Normal',
			'Slide Sorter',
			'Outline View',
			'Reading View',
		]);
		for (const id of ['view.masterViews.slideMaster', 'view.zoom.fitToWindow']) {
			expect(button(target, id).disabled).toBeFalsy();
		}
		for (const id of [
			'view.masterViews.handoutMaster',
			'view.masterViews.notesMaster',
			'view.zoom.zoom',
			'view.window.macros',
		]) {
			expect(button(target, id).disabled).toBeTruthy();
		}
	});

	it('routes every presentation view to its view switch', () => {
		const onnormal = vi.fn();
		const onslidesorter = vi.fn();
		const onoutlineview = vi.fn();
		const onreadingview = vi.fn();
		const target = mountTab({ onnormal, onslidesorter, onoutlineview, onreadingview });
		button(target, 'view.presentationViews.normal').click();
		button(target, 'view.presentationViews.slideSorter').click();
		button(target, 'view.presentationViews.outline').click();
		button(target, 'view.presentationViews.readingView').click();
		expect(
			[onnormal, onslidesorter, onoutlineview, onreadingview].map((fn) => fn.mock.calls.length),
		).toStrictEqual([1, 1, 1, 1]);
	});

	it('drives guide visibility from Guides and snapping from Snap to Shape', () => {
		const onshowguideschange = vi.fn();
		const onsnapToShapechange = vi.fn();
		const onpreferenceschange = vi.fn();
		const target = mountTab({ onshowguideschange, onsnapToShapechange, onpreferenceschange });
		const row = target.querySelector('[data-ribbon-control="view.show.guides"]')!;
		(row.shadowRoot!.querySelector('pptx-ui-checkbox') as HTMLElement).click();
		expect(onshowguideschange).toHaveBeenCalledExactlyOnceWith(true);
		expect(onsnapToShapechange).not.toHaveBeenCalled();
		button(target, 'view.show.snapToShape').click();
		expect(onsnapToShapechange).toHaveBeenCalledExactlyOnceWith(true);
		const grid = target.querySelector('[data-ribbon-control="view.show.gridlines"]')!;
		(grid.shadowRoot!.querySelector('pptx-ui-checkbox') as HTMLElement).click();
		expect(onpreferenceschange.mock.calls[0][0].showGrid).toBe(
			!DEFAULT_VIEWER_PREFERENCES.showGrid,
		);
	});
});
