/**
 * text-style-scope.test.ts: a `TextStyle` update carries both body-level
 * (`a:bodyPr` / paragraph geometry the block builder reads from
 * `element.textStyle` only) and run-level keys. When an inline selection is
 * active the run keys go to the selected runs and the body keys MUST still
 * reach `element.textStyle`, or Increase Indent does nothing.
 */

import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	BODY_TEXT_STYLE_KEYS,
	isBodyTextStyleKey,
	reconcileDecorationFlags,
	splitTextStyleUpdate,
} from './text-style-scope';

const seg = (text: string, style: TextSegment['style'] = {}): TextSegment => ({ text, style });

describe('body text style keys', () => {
	it('names every key text-block-style reads from element.textStyle only', () => {
		for (const key of [
			'paragraphMarginLeft',
			'paragraphMarginRight',
			'paragraphIndent',
			'vAlign',
			'textDirection',
			'columnCount',
			'columnSpacing',
			'textWrap',
			'autoFit',
			'autoFitMode',
			'bodyInsetLeft',
			'bodyInsetTop',
			'bodyInsetRight',
			'bodyInsetBottom',
			'lineSpacing',
			'paragraphSpacingBefore',
			'paragraphSpacingAfter',
			'textWarpPreset',
		]) {
			expect(isBodyTextStyleKey(key)).toBeTruthy();
		}
	});

	it('leaves run-level keys to the selected runs', () => {
		for (const key of ['bold', 'italic', 'underline', 'strikethrough', 'fontSize', 'color']) {
			expect(BODY_TEXT_STYLE_KEYS.has(key as never)).toBeFalsy();
		}
	});
});

describe('splitTextStyleUpdate', () => {
	it('partitions an update into body and run halves', () => {
		const split = splitTextStyleUpdate({
			paragraphMarginLeft: 24,
			bold: true,
			vAlign: 'middle',
			fontSize: 12,
		});
		expect(split.body).toStrictEqual({ paragraphMarginLeft: 24, vAlign: 'middle' });
		expect(split.run).toStrictEqual({ bold: true, fontSize: 12 });
	});

	it('keeps an explicit undefined so a clear still reaches its target', () => {
		const split = splitTextStyleUpdate({ highlightColor: undefined, textWrap: undefined });
		expect('highlightColor' in split.run).toBeTruthy();
		expect('textWrap' in split.body).toBeTruthy();
	});
});

describe('reconcileDecorationFlags', () => {
	it('drops the body flag once a run no longer carries it, keeping the others decorated', () => {
		const segments = [seg('keep'), seg('plain', { underline: false })];
		const next = reconcileDecorationFlags(segments, { underline: true, fontSize: 18 }, [
			'underline',
		]);
		expect(next.textStyle).toStrictEqual({ fontSize: 18 });
		expect(next.textSegments[0].style.underline).toBeTruthy();
		expect(next.textSegments[1].style.underline).toBeFalsy();
	});

	it('promotes the body flag when every content run agrees', () => {
		const segments = [
			seg('a', { bold: true }),
			{ text: '\n', style: {}, isParagraphBreak: true },
			seg('b', { bold: true }),
		];
		const next = reconcileDecorationFlags(segments, {}, ['bold']);
		expect(next.textStyle.bold).toBeTruthy();
		expect(next.textSegments).toStrictEqual(segments);
	});

	it('only touches the flags it is asked about', () => {
		const segments = [seg('a', { italic: false })];
		const next = reconcileDecorationFlags(segments, { italic: true, bold: true }, ['bold']);
		expect(next.textStyle).toStrictEqual({ italic: true, bold: true });
	});
});
