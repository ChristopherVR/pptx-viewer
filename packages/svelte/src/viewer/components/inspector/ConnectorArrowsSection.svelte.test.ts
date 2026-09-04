import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { CONNECTOR_ARROW_CONTROLS } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ConnectorArrowsSection from './ConnectorArrowsSection.svelte';

/**
 * Svelte offered two of the six arrowhead controls (the `type` pickers), so a
 * connector's `@w` / `@len` steps were unreachable even though the renderer
 * honoured them. These tests check the four things a control has to do to count
 * as shipped: it exists under React's accessible name, it offers the shared
 * token list, picking a value writes THAT property onto the element, and undo
 * puts the previous value back.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function connector(shapeStyle: ShapeStyle = {}): PptxElement {
	return {
		type: 'connector',
		id: 'conn-1',
		x: 0,
		y: 0,
		width: 120,
		height: 40,
		shapeStyle,
	} as PptxElement;
}

function editorWith(element: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }]);
	editor.select(element.id);
	return editor;
}

function render(element: PptxElement): { editor: EditorState; target: HTMLElement } {
	const editor = editorWith(element);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ConnectorArrowsSection, {
		target,
		props: {
			editor,
			style: element.type === 'connector' ? element.shapeStyle : undefined,
			el: element,
		},
	});
	cleanup = () => {
		void unmount(instance);
		target.remove();
	};
	flushSync();
	return { editor, target };
}

/** Only the label's own text nodes, so the nested option text is excluded. */
function ownText(element: Element): string {
	return Array.from(element.childNodes)
		.filter((node) => node.nodeType === Node.TEXT_NODE)
		.map((node) => node.textContent ?? '')
		.join('')
		.trim();
}

function selectFor(root: ParentNode, caption: string): HTMLSelectElement {
	for (const label of Array.from(root.querySelectorAll('label'))) {
		if (ownText(label) === caption) {
			const select = label.querySelector('select');
			if (select) {
				return select;
			}
		}
	}
	throw new Error(`no select captioned "${caption}"`);
}

function styleOf(editor: EditorState): ShapeStyle | undefined {
	const selected = editor.selectedElement;
	return selected && 'shapeStyle' in selected ? selected.shapeStyle : undefined;
}

describe('connectorArrowsSection', () => {
	it('offers all six controls under the same names React uses', () => {
		const { target } = render(connector());

		expect(Array.from(target.querySelectorAll('label')).map(ownText)).toStrictEqual([
			'Start Arrow',
			'End Arrow',
			'Start Width',
			'Start Length',
			'End Width',
			'End Length',
		]);
	});

	it('spells the options rather than showing `stealth` or `med`', () => {
		const { target } = render(connector());

		expect(
			Array.from(selectFor(target, 'Start Arrow').options).map((option) => option.textContent),
		).toStrictEqual(['None', 'Triangle', 'Stealth', 'Diamond', 'Oval', 'Open Arrow']);
		expect(
			Array.from(selectFor(target, 'End Width').options).map((option) => option.textContent),
		).toStrictEqual(['Small', 'Medium', 'Large']);
	});

	it('shows the authored value, and the schema default where the style is silent', () => {
		const { target } = render(
			connector({ connectorStartArrow: 'oval', connectorStartArrowWidth: 'lg' }),
		);

		expect(selectFor(target, 'Start Arrow').value).toBe('oval');
		expect(selectFor(target, 'Start Width').value).toBe('lg');
		// An absent `a:headEnd` means no head; an absent `@w`/`@len` means medium.
		expect(selectFor(target, 'End Arrow').value).toBe('none');
		expect(selectFor(target, 'End Length').value).toBe('med');
	});

	it('writes each control to its own property, and undo restores it', () => {
		const picks: Array<[string, string]> = [
			['Start Arrow', 'stealth'],
			['End Arrow', 'diamond'],
			['Start Width', 'lg'],
			['Start Length', 'sm'],
			['End Width', 'sm'],
			['End Length', 'lg'],
		];

		for (const [caption, value] of picks) {
			const control = CONNECTOR_ARROW_CONTROLS.find(
				(candidate) => translationsEn[candidate.labelKey] === caption,
			);
			if (!control) {
				throw new Error(`no shared control captioned "${caption}"`);
			}
			const { editor, target } = render(connector({ connectorStartArrow: 'triangle' }));
			const select = selectFor(target, caption);

			select.value = value;
			select.dispatchEvent(new Event('change', { bubbles: true }));
			flushSync();
			expect([caption, styleOf(editor)?.[control.styleKey]]).toStrictEqual([caption, value]);
			// The merge is non-destructive: a sibling property survives the write.
			expect(styleOf(editor)?.connectorStartArrow).toBe(
				control.styleKey === 'connectorStartArrow' ? value : 'triangle',
			);

			editor.undo();
			flushSync();
			expect([caption, styleOf(editor)?.[control.styleKey]]).not.toStrictEqual([caption, value]);

			cleanup?.();
			cleanup = undefined;
		}
	});

	// G9 (OpenXML parity audit, D3): a:cxnSpLocks/@noChangeArrowheads already
	// computed `arrowheadsChangeable` in element-locks.ts but nothing here
	// consulted it.
	it('disables every dropdown when the connector locks noChangeArrowheads', () => {
		const locked = {
			...connector(),
			locks: { noChangeArrowheads: true },
		} as PptxElement;
		const { target } = render(locked);
		const selects = Array.from(target.querySelectorAll<HTMLSelectElement>('select'));
		expect(selects).toHaveLength(6);
		expect(selects.every((s) => s.disabled)).toBeTruthy();
	});

	it('ignores a change event on a locked connector (defence in depth)', () => {
		const locked = {
			...connector({ connectorStartArrow: 'triangle' }),
			locks: { noChangeArrowheads: true },
		} as PptxElement;
		const { editor, target } = render(locked);
		const select = selectFor(target, 'Start Arrow');
		select.value = 'oval';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect(styleOf(editor)?.connectorStartArrow).toBe('triangle');
	});
});
