import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ActionSettingsPanel from './ActionSettingsPanel.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeEl(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		...overrides,
	} as PptxElement;
}

function mountPanel(el: PptxElement, slideCount = 3): { target: HTMLElement; editor: EditorState } {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.setSlides(
		Array.from({ length: slideCount }, (_, index) => ({
			id: `s${index + 1}`,
			rId: `rId${index + 1}`,
			slideNumber: index + 1,
			elements: index === 0 ? [el] : [],
		})),
	);
	editor.editable = true;
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ActionSettingsPanel, { target, props: { editor, el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, editor };
}

function selects(target: HTMLElement): HTMLSelectElement[] {
	return Array.from(target.querySelectorAll<HTMLSelectElement>('select'));
}

function setValue(control: HTMLSelectElement | HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('actionSettingsPanel', () => {
	it('renders an On Click and an On Hover trigger, both defaulting to none', () => {
		const { target } = mountPanel(shapeEl());
		const triggers = selects(target);

		expect(triggers).toHaveLength(2);
		expect(triggers[0].getAttribute('aria-label')).toBe('On Click');
		expect(triggers[1].getAttribute('aria-label')).toBe('On Hover');
		expect(triggers.every((select) => select.value === 'none')).toBeTruthy();
	});

	it('writes a navigation action onto actionClick', () => {
		const el = shapeEl();
		const { target, editor } = mountPanel(el);

		setValue(selects(target)[0], 'nextSlide');

		const updated = editor.slides[0]?.elements?.[0] as PptxElement;
		expect(updated.actionClick).toBeDefined();
		expect(JSON.stringify(updated.actionClick)).toContain('nextslide');
	});

	it('reveals a URL input only for the url action and stores what is typed', () => {
		const el = shapeEl();
		const { target, editor } = mountPanel(el);

		expect(target.querySelector('input[type="text"]')).toBeNull();
		setValue(selects(target)[0], 'url');

		const url = target.querySelector<HTMLInputElement>('input[type="text"]');
		expect(url).not.toBeNull();
		setValue(url!, 'https://example.com/');

		const updated = editor.slides[0]?.elements?.[0] as PptxElement;
		expect(updated.actionClick?.url).toBe('https://example.com/');
	});

	it('reveals the url input without writing a target-less action', () => {
		const el = shapeEl();
		const { target, editor } = mountPanel(el);

		setValue(selects(target)[0], 'url');

		// The pick is only held in the panel: a url action with no url serialises
		// to an action that parses back as "none", so committing it would wipe
		// the choice the user is halfway through making.
		expect(target.querySelector('input[type="text"]')).not.toBeNull();
		const updated = editor.slides[0]?.elements?.[0] as PptxElement;
		expect(updated.actionClick).toBeUndefined();
	});

	it('converts the 1-based slide number to a 0-based index and clamps it', () => {
		const el = shapeEl();
		const { target, editor } = mountPanel(el, 3);

		setValue(selects(target)[0], 'slide');
		const slide = target.querySelector<HTMLInputElement>('input[type="number"]');
		expect(slide).not.toBeNull();
		setValue(slide!, '99');

		const updated = editor.slides[0]?.elements?.[0] as PptxElement;
		expect(updated.actionClick?.targetSlideIndex).toBe(2);
	});

	it('writes the hover trigger independently of the click trigger', () => {
		const el = shapeEl();
		const { target, editor } = mountPanel(el);

		setValue(selects(target)[1], 'firstSlide');

		const updated = editor.slides[0]?.elements?.[0] as PptxElement;
		expect(updated.actionHover).toBeDefined();
		expect(updated.actionClick).toBeUndefined();
	});

	/**
	 * Wave-4 B7: picking "Custom show" reveals the show picker; picking a show
	 * commits `customShowId` only once one is chosen (a target-less pick still
	 * parses back as no action, matching `url`/`slide`).
	 */
	it('the custom-show picker commits customShowId once a show is chosen', () => {
		const el = shapeEl();
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
		editor.presentationMetadata.set(undefined, undefined, [
			{ id: 'cs1', name: 'Sub show', slideRIds: ['rId1'] },
		]);
		editor.editable = true;
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ActionSettingsPanel, { target, props: { editor, el } });
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};

		setValue(selects(target)[0], 'customShow');
		const showSelect = target.querySelector<HTMLSelectElement>(
			'[data-testid="pptx-action-custom-show"]',
		);
		expect(showSelect).not.toBeNull();
		expect(editor.slides[0]?.elements?.[0]?.actionClick).toBeUndefined();

		setValue(showSelect!, 'cs1');
		const updated = editor.slides[0]?.elements?.[0] as PptxElement;
		expect(updated.actionClick?.action).toContain('id=cs1');
	});

	/**
	 * The return-after checkbox commits `returnAfter` alongside the ALREADY
	 * committed `customShowId` (an element that already carries a customShow
	 * action, as `pptxActionToElementAction` would hand back after a load).
	 */
	it('the return-after checkbox commits returnAfter, preserving customShowId', () => {
		const el = shapeEl({ actionClick: { action: 'ppaction://customshow?id=cs1' } });
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
		editor.presentationMetadata.set(undefined, undefined, [
			{ id: 'cs1', name: 'Sub show', slideRIds: ['rId1'] },
		]);
		editor.editable = true;
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ActionSettingsPanel, { target, props: { editor, el } });
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};

		expect(selects(target)[0].value).toBe('customShow');
		const returnCheckbox = target.querySelector<HTMLInputElement>(
			'[data-testid="pptx-action-custom-show-return"]',
		);
		expect(returnCheckbox).not.toBeNull();
		returnCheckbox!.checked = true;
		returnCheckbox!.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const updated = editor.slides[0]?.elements?.[0] as PptxElement;
		expect(updated.actionClick?.action).toContain('id=cs1');
		expect(updated.actionClick?.action).toContain('return=true');
	});

	it('openFile reuses the same text target field as url', () => {
		const el = shapeEl();
		const { target, editor } = mountPanel(el);

		setValue(selects(target)[0], 'openFile');
		const urlInput = target.querySelector<HTMLInputElement>('input[type="text"]');
		expect(urlInput).not.toBeNull();
		setValue(urlInput!, 'C:/decks/appendix.pptx');

		const updated = editor.slides[0]?.elements?.[0] as PptxElement;
		expect(updated.actionClick?.url).toBe('C:/decks/appendix.pptx');
		expect(updated.actionClick?.action).toBe('ppaction://hlinkfile');
	});

	it('disables both triggers in a read-only viewer', () => {
		const el = shapeEl();
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ActionSettingsPanel, { target, props: { editor, el } });
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};

		expect(selects(target).every((select) => select.disabled)).toBeTruthy();
	});
});
