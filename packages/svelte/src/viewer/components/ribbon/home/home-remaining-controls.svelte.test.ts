import type { PptxElement } from 'pptx-viewer-core';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import type { Component } from 'svelte';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { I18N_CONTEXT_KEY } from '../../../../i18n/context';
import { FindReplaceState } from '../../../editor/editor-find-replace.svelte';
import { EditorState } from '../../../editor/editor-state.svelte';
import ArrangeExtras from './ArrangeExtras.svelte';
import EditingGroup from './EditingGroup.svelte';
import FontFormattingGroup from './FontFormattingGroup.svelte';

registerPptxWebControls();

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const TEXT = {
	type: 'text',
	id: 'text-1',
	x: 0,
	y: 0,
	width: 100,
	height: 20,
	text: 'Hi',
	textStyle: {},
} as PptxElement;
const PICTURE = {
	type: 'picture',
	id: 'pic',
	x: 0,
	y: 0,
	width: 200,
	height: 100,
	imageData: 'data:image/png;base64,AAAA',
} as PptxElement;

function makeEditor(elements: PptxElement[], selected: string): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements }]);
	editor.select(selected);
	return editor;
}

function render(
	component: Component<never>,
	props: Record<string, unknown>,
	context?: Map<unknown, unknown>,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component as Component<Record<string, unknown>>, {
		target,
		props,
		context,
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

const slot = (target: HTMLElement, id: string) =>
	target.querySelector<HTMLElement>(`[data-ribbon-control="${id}"]`)!;
const element = (editor: EditorState) =>
	editor.slides[0]?.elements[0] as PptxElement & {
		textStyle?: Record<string, unknown>;
	};

describe('shared Font extras', () => {
	it('applies a spacing choice, a case change and a theme colour with its reference', () => {
		const editor = makeEditor([TEXT], 'text-1');
		editor.theme = {
			colorScheme: {
				dk1: '#000000',
				lt1: '#ffffff',
				dk2: '#44546a',
				lt2: '#e7e6e6',
				accent1: '#4472c4',
				accent2: '#ed7d31',
				accent3: '#a5a5a5',
				accent4: '#ffc000',
				accent5: '#5b9bd5',
				accent6: '#70ad47',
				hlink: '#0563c1',
				folHlink: '#954f72',
			},
		};
		const target = render(FontFormattingGroup, { editor });
		const spacing = slot(target, 'home.font.characterSpacing') as HTMLElement & { value: string };
		spacing.value = '75';
		spacing.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect(element(editor).textStyle?.characterSpacing).toBe(75);

		const color = slot(target, 'home.font.fontColor');
		color.querySelector('button')!.click();
		color.querySelector<HTMLElement>('[data-theme-swatch="accent1"]')!.click();
		flushSync();
		expect(element(editor).textStyle?.color).toBe('#4472c4');
		expect(element(editor).textStyle?.colorRef).toMatchObject({ scheme: 'accent1' });
		expect(editor.mruColors.map((c) => c.toLowerCase())).toContain('#4472c4');

		const highlight = slot(target, 'home.font.highlightColor');
		highlight.querySelector('button')!.click();
		highlight.querySelector<HTMLElement>('.std-grid button.sw')!.click();
		flushSync();
		expect(element(editor).textStyle?.highlightColor).toBe('#ffff00');
	});

	it('disables every extra without a text selection', () => {
		const editor = makeEditor([PICTURE], 'pic');
		const target = render(FontFormattingGroup, { editor });
		for (const id of ['fontColor', 'highlightColor', 'changeCase']) {
			expect(slot(target, `home.font.${id}`).querySelector('button')?.disabled).toBeTruthy();
		}
		expect(slot(target, 'home.font.characterSpacing').hasAttribute('disabled')).toBeTruthy();
	});
});

describe('shared Arrange shape extras', () => {
	it('toggles crop on a picture, applies a preset and sets the outline width', () => {
		const editor = makeEditor([PICTURE], 'pic');
		const target = render(ArrangeExtras, { editor });
		const crop = target.querySelector<HTMLButtonElement>('[data-pptx-ribbon-control="crop"]')!;
		expect(crop.disabled).toBeFalsy();
		crop.click();
		flushSync();
		expect(editor.cropOps.active).toBeTruthy();
		editor.cropOps.cancel();
		target.querySelector<HTMLButtonElement>('[data-pptx-ribbon-control="crop-menu"]')!.click();
		target.querySelector<HTMLElement>('[data-pptx-crop-aspect="1:1"]')!.click();
		flushSync();
		expect(editor.elementById('pic')?.width).toBeCloseTo(100);
		editor.undo();
		expect(editor.elementById('pic')?.width).toBe(200);
		const width = slot(target, 'home.arrange.outlineWidth') as HTMLInputElement;
		expect(width.getAttribute('aria-label')).toBe('Stroke width');
	});

	it('mirrors the Format Painter pill from the controller', () => {
		const editor = makeEditor([TEXT], 'text-1');
		const target = render(ArrangeExtras, { editor });
		const pill = target.querySelector<HTMLButtonElement>('[data-testid="format-painter-toggle"]')!;
		expect(pill.textContent).toBe('Format');
		pill.click();
		flushSync();
		expect(pill.getAttribute('aria-pressed')).toBe(String(editor.formatPainter.active));
	});
});

describe('runtime locale', () => {
	it('re-translates the Select menu and trigger when the language changes', () => {
		let locale = $state('en');
		const editor = makeEditor([TEXT], 'text-1');
		const findReplace = new FindReplaceState({
			getSlides: () => editor.slides,
			commitSlides: () => {},
		});
		const translator = (key: string) => `${locale}:${key}`;
		const target = render(
			EditingGroup,
			{ editor, findReplace },
			new Map([[I18N_CONTEXT_KEY, translator]]),
		);
		const trigger = slot(target, 'home.editing.select').querySelector('button')!;
		trigger.click();
		flushSync();
		const row = () => slot(target, 'home.editing.select').querySelector('[role="menuitem"]')!;
		expect(row().textContent).toBe('en:pptx.editing.selectAll');
		locale = 'fr';
		flushSync();
		expect(row().textContent).toBe('fr:pptx.editing.selectAll');
		expect(trigger.title).toBe('fr:pptx.ribbon.tool.select');
	});
});
