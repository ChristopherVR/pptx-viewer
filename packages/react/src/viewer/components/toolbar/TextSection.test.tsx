// @vitest-environment happy-dom
/**
 * TextSection (ribbon Home > Font / Paragraph groups):
 *
 * - Bold / Italic / Underline / Strikethrough decide their next value from the
 *   runs, not from `element.textStyle` (`!ts?.bold` re-bolded a run-level bold
 *   word forever).
 * - Bullets / Numbering route through the shared bullet toggle (a real
 *   `bulletInfo`), not a `listType` text-style patch nothing renders; table
 *   cells keep their cell-style path.
 */
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import {
	attachInlineListController,
	createInlineListSeed,
	initializeInlineListDom,
} from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecentColorsProvider } from '../inspector/RecentColorsContext';
import { textSectionBulletKind } from './text-section-state';
import { TextSection } from './TextSection';
import type { TextSectionProps } from './TextSection';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function textElement(segments: TextSegment[], textStyle: TextStyle = {}) {
	return {
		id: 't1',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: segments.map((s) => s.text).join(''),
		textStyle,
		textSegments: segments,
	} as unknown as PptxElement;
}

function renderSection(props: Partial<TextSectionProps>) {
	const onUpdateTextStyle = vi.fn();
	const onToggleBullets = vi.fn();
	act(() => {
		root.render(
			<RecentColorsProvider value={{ recentColors: [], pushColor: () => {} }}>
				<TextSection
					canEdit
					selectedElement={null}
					onUpdateTextStyle={onUpdateTextStyle}
					onToggleBullets={onToggleBullets}
					onTransformTextCase={() => {}}
					{...props}
				/>
			</RecentColorsProvider>,
		);
	});
	return { onUpdateTextStyle, onToggleBullets };
}

function buttonTitled(...titles: string[]): HTMLButtonElement {
	const match = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
		titles.includes(b.title),
	);
	if (!match) {
		throw new Error(`missing button: ${titles.join(' / ')}`);
	}
	return match;
}

describe('textSection decoration toggles', () => {
	it('reads list kind from the caret paragraph without changing character toggle scope', () => {
		const element = textElement([
			{ text: 'First', style: {}, bulletInfo: { char: '◆' } },
			{ text: '\n', style: {}, isParagraphBreak: true },
			{ text: 'Last', style: {} },
		]);
		const seed = createInlineListSeed(element)!;
		const editor = document.createElement('div');
		document.body.append(editor);
		initializeInlineListDom(editor, seed);
		const controller = attachInlineListController(editor, seed);
		const node = editor.lastElementChild!.firstElementChild!.firstChild!;
		window.getSelection()!.setBaseAndExtent(node, 0, node, 0);
		expect(textSectionBulletKind(element, undefined)).toBe('none');
		controller.dispose();
		editor.remove();
	});

	it('decides from the current rich selection rather than stale model runs', () => {
		const model = textElement([{ text: 'Old', style: {} }]);
		const { onUpdateTextStyle } = renderSection({ selectedElement: model });
		const seed = createInlineListSeed(
			textElement([{ text: 'Typed', style: { bold: true }, bulletInfo: { char: '◆' } }]),
		)!;
		const editor = document.createElement('div');
		document.body.append(editor);
		initializeInlineListDom(editor, seed);
		const controller = attachInlineListController(editor, seed);
		try {
			const range = document.createRange();
			range.selectNodeContents(editor.querySelector('[data-pptx-list-run]')!);
			window.getSelection()!.removeAllRanges();
			window.getSelection()!.addRange(range);
			act(() => buttonTitled('Bold', 'pptx.textPanel.bold').click());
			expect(onUpdateTextStyle).toHaveBeenCalledWith({ bold: false });
		} finally {
			controller.dispose();
			editor.remove();
			window.getSelection()?.removeAllRanges();
		}
	});

	it('un-bolds a box whose runs are bold at run level while the body is not', () => {
		const { onUpdateTextStyle } = renderSection({
			selectedElement: textElement([{ text: 'Hello', style: { bold: true } }]),
		});
		act(() => buttonTitled('Bold', 'pptx.textPanel.bold').click());
		expect(onUpdateTextStyle).toHaveBeenCalledWith({ bold: false });
	});

	it('turns a mixed box on, and shows it as not pressed', () => {
		const { onUpdateTextStyle } = renderSection({
			selectedElement: textElement([
				{ text: 'Hello ', style: { underline: true } },
				{ text: 'world', style: {} },
			]),
		});
		const button = buttonTitled('Underline', 'pptx.textPanel.underline');
		expect(button.getAttribute('aria-pressed')).toBe('false');
		act(() => button.click());
		expect(onUpdateTextStyle).toHaveBeenCalledWith({ underline: true });
	});

	it('still decides from the cell style for a table cell', () => {
		const table = {
			id: 'tb',
			type: 'table',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			tableData: { rows: [{ cells: [{ text: 'x', style: { bold: true } }] }], columnWidths: [] },
		} as unknown as PptxElement;
		const { onUpdateTextStyle } = renderSection({
			selectedElement: table,
			tableEditorState: { elementId: 'tb', rowIndex: 0, columnIndex: 0 } as never,
		});
		act(() => buttonTitled('Bold', 'pptx.textPanel.bold').click());
		expect(onUpdateTextStyle).toHaveBeenCalledWith({ bold: false });
	});
});

describe('textSection bullets and numbering', () => {
	it('routes a text element through the bullet toggle, never a listType patch', () => {
		const { onUpdateTextStyle, onToggleBullets } = renderSection({
			selectedElement: textElement([{ text: 'Item', style: {} }]),
		});
		act(() => buttonTitled('Bullet List', 'pptx.text.bulletList').click());
		act(() => buttonTitled('Numbered List', 'pptx.text.numberedList').click());
		expect(onToggleBullets.mock.calls).toStrictEqual([['bullet'], ['numbered']]);
		expect(onUpdateTextStyle).not.toHaveBeenCalled();
	});

	it('shows the pressed state from the paragraphs, not textStyle.listType', () => {
		renderSection({
			selectedElement: textElement(
				[
					{ text: '• ', style: {}, bulletInfo: { char: '•' } },
					{ text: 'Item', style: {} },
				],
				{ listType: 'none' },
			),
		});
		expect(buttonTitled('Bullet List', 'pptx.text.bulletList').getAttribute('aria-pressed')).toBe(
			'true',
		);
		expect(
			buttonTitled('Numbered List', 'pptx.text.numberedList').getAttribute('aria-pressed'),
		).toBe('false');
	});

	it('keeps the cell-style path for a table cell', () => {
		const table = {
			id: 'tb',
			type: 'table',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			tableData: { rows: [{ cells: [{ text: 'x', style: {} }] }], columnWidths: [] },
		} as unknown as PptxElement;
		const { onUpdateTextStyle, onToggleBullets } = renderSection({
			selectedElement: table,
			tableEditorState: { elementId: 'tb', rowIndex: 0, columnIndex: 0 } as never,
		});
		act(() => buttonTitled('Bullet List', 'pptx.text.bulletList').click());
		expect(onUpdateTextStyle).toHaveBeenCalledWith({ listType: 'bullet' });
		expect(onToggleBullets).not.toHaveBeenCalled();
	});
});
