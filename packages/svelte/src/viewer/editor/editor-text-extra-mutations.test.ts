import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	changeCasePatch,
	clearFormattingPatch,
	setCharacterSpacingPatch,
	setFontFamilyPatch,
	toggleStrikethroughPatch,
} from './editor-text-extra-mutations';

function textEl(
	textStyle: PptxElement['textStyle'] = {},
	textSegments: TextSegment[] = [],
): PptxElement {
	return {
		type: 'text',
		id: 'e1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		text: 'Hello world',
		textSegments,
		textStyle,
	} as PptxElement;
}

describe('editor-text-extra-mutations toggle/set patches', () => {
	it('toggles strikethrough', () => {
		expect(toggleStrikethroughPatch(textEl()).textStyle?.strikethrough).toBeTruthy();
		expect(
			toggleStrikethroughPatch(textEl({ strikethrough: true })).textStyle?.strikethrough,
		).toBeFalsy();
	});

	it('sets font family and character spacing, preserving other fields', () => {
		const base = textEl({ bold: true });
		expect(setFontFamilyPatch(base, 'Georgia').textStyle).toStrictEqual({
			bold: true,
			fontFamily: 'Georgia',
		});
		expect(setCharacterSpacingPatch(base, 75).textStyle).toStrictEqual({
			bold: true,
			characterSpacing: 75,
		});
	});
});

describe('editor-text-extra-mutations changeCasePatch', () => {
	it('rewrites textSegments and text when segments are present', () => {
		const segments: TextSegment[] = [{ text: 'hello world', style: {} }];
		const patch = changeCasePatch(textEl({}, segments), 'upper');
		expect(patch.text).toBe('HELLO WORLD');
		expect((patch.textSegments as TextSegment[])[0].text).toBe('HELLO WORLD');
	});

	it('falls back to a textCaps style toggle when there are no segments', () => {
		const patch = changeCasePatch(textEl(), 'upper');
		expect(patch.textStyle?.textCaps).toBe('all');
		const lower = changeCasePatch(textEl(), 'lower');
		expect(lower.textStyle?.textCaps).toBe('none');
	});

	it('reconciles against a live open inline editor before transforming case', () => {
		// `InlineTextEditor.svelte`'s contenteditable is uncontrolled: text typed
		// since the edit session began is not yet on `el.textSegments`/`.text`.
		// Regression: previously the case transform ran against that stale
		// snapshot, leaving anything typed since untransformed once the edit
		// session committed.
		const editor = document.createElement('div');
		editor.dataset.inlineEditor = '';
		editor.textContent = 'hello world, typed more';
		document.body.appendChild(editor);
		try {
			const segments: TextSegment[] = [{ text: 'hello world', style: {} }]; // stale
			const patch = changeCasePatch(textEl({}, segments), 'upper');
			expect(patch.text).toBe('HELLO WORLD, TYPED MORE');
			expect((patch.textSegments as TextSegment[]).map((s) => s.text).join('')).toBe(
				'HELLO WORLD, TYPED MORE',
			);
		} finally {
			editor.remove();
		}
	});
});

describe('editor-text-extra-mutations clearFormattingPatch', () => {
	it('resets bold/italic/underline/strikethrough/highlight', () => {
		const base = textEl({
			bold: true,
			italic: true,
			underline: true,
			strikethrough: true,
			highlightColor: '#ffff00',
			fontFamily: 'Georgia',
		});
		const patch = clearFormattingPatch(base);
		expect(patch.textStyle).toStrictEqual({
			bold: false,
			italic: false,
			underline: false,
			strikethrough: false,
			highlightColor: undefined,
			fontFamily: 'Georgia',
		});
	});
});
