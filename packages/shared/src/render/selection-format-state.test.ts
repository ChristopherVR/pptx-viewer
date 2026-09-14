/**
 * selection-format-state.test.ts: the ribbon's Bold / Italic / Underline /
 * Strikethrough toggles must decide on/off from the runs the user selected,
 * not from the element's body-level style (`!ts?.bold` re-applied bold to a
 * run that was already bold whenever the body was not).
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	contentSegmentsInSelection,
	getSelectionTextStyleFlags,
	nextToggleValue,
	textStyleFlagsOf,
} from './selection-format-state';

const seg = (text: string, style: TextSegment['style'] = {}): TextSegment => ({ text, style });
const brk = (): TextSegment => ({ text: '\n', style: {}, isParagraphBreak: true });

const textElement = (segments: TextSegment[], textStyle: PptxElement['textStyle'] = {}) =>
	({
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: segments.map((s) => s.text).join(''),
		textStyle,
		textSegments: segments,
	}) as unknown as PptxElement;

describe('contentSegmentsInSelection', () => {
	it('drops paragraph breaks and bullet markers, keeps the selected index range', () => {
		const segments = [seg('• ', {}), seg('One'), brk(), seg('Two')];
		segments[0].bulletInfo = { char: '•' };
		expect(contentSegmentsInSelection(segments, null).map((s) => s.text)).toStrictEqual([
			'One',
			'Two',
		]);
		expect(
			contentSegmentsInSelection(segments, {
				startSegIdx: 3,
				startOffset: 0,
				endSegIdx: 3,
				endOffset: 3,
			}).map((s) => s.text),
		).toStrictEqual(['Two']);
	});
});

describe('getSelectionTextStyleFlags', () => {
	it('ignores zero-width endpoints when deciding whether to turn formatting off', () => {
		const segments = [seg('off'), seg('BOLD', { bold: true }), seg('off')];
		const flags = getSelectionTextStyleFlags(
			segments,
			{
				startSegIdx: 0,
				startOffset: 3,
				endSegIdx: 2,
				endOffset: 0,
			},
			{},
		);
		expect(flags.bold).toBe('on');
		expect(nextToggleValue(flags.bold)).toBeFalsy();
	});

	it('reads a run-level bold the body does not carry as on', () => {
		const segments = [seg('Hello '), seg('world', { bold: true })];
		const flags = getSelectionTextStyleFlags(
			segments,
			{ startSegIdx: 1, startOffset: 0, endSegIdx: 1, endOffset: 5 },
			{},
		);
		expect(flags.bold).toBe('on');
		expect(flags.italic).toBe('off');
	});

	it('reports mixed when the selected runs disagree', () => {
		const segments = [seg('Hello ', { underline: true }), seg('world')];
		const flags = getSelectionTextStyleFlags(
			segments,
			{ startSegIdx: 0, startOffset: 2, endSegIdx: 1, endOffset: 2 },
			{},
		);
		expect(flags.underline).toBe('mixed');
	});

	it('inherits the body flag for a run that sets none of its own', () => {
		const segments = [seg('A'), seg('B')];
		expect(getSelectionTextStyleFlags(segments, null, { italic: true }).italic).toBe('on');
		expect(getSelectionTextStyleFlags(segments, null, { italic: true, bold: false }).bold).toBe(
			'off',
		);
	});

	it('lets an explicit run false override a body true', () => {
		const segments = [seg('A', { strikethrough: false }), seg('B')];
		expect(getSelectionTextStyleFlags(segments, null, { strikethrough: true }).strikethrough).toBe(
			'mixed',
		);
	});

	it('falls back to the body style when there are no content runs', () => {
		expect(getSelectionTextStyleFlags(undefined, null, { bold: true }).bold).toBe('on');
		expect(getSelectionTextStyleFlags([], null, undefined).bold).toBe('off');
	});
});

describe('nextToggleValue', () => {
	it('turns off only when every selected run is on', () => {
		expect(nextToggleValue('on')).toBeFalsy();
		expect(nextToggleValue('off')).toBeTruthy();
		expect(nextToggleValue('mixed')).toBeTruthy();
	});
});

describe('textStyleFlagsOf', () => {
	it('derives the flags from the element runs, or the body when it has none', () => {
		expect(textStyleFlagsOf(textElement([seg('x', { bold: true })])).bold).toBe('on');
		expect(textStyleFlagsOf(textElement([], { bold: true })).bold).toBe('on');
	});

	it('is all off for an element without text properties or none at all', () => {
		const table = { type: 'table', id: 'tb', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		expect(textStyleFlagsOf(table)).toStrictEqual({
			bold: 'off',
			italic: 'off',
			underline: 'off',
			strikethrough: 'off',
		});
		expect(textStyleFlagsOf(null).bold).toBe('off');
	});

	it('scopes to a live segment override when one is supplied', () => {
		const el = textElement([seg('stale')]);
		expect(textStyleFlagsOf(el, null, [seg('live', { bold: true })]).bold).toBe('on');
	});
});
