import { describe, expect, it } from 'vitest';

import type { ElementAnimationState } from './animation-timeline-types';
import { buildTextBuildSpec, textBuildSpanStyle } from './text-build-spans';

/**
 * Regression for issue #106: a title authored to fade in letter by letter
 * faded in as one block outside React, because only React split the rendered
 * text to match the per-character sub-animations.
 */
function states(entries: Record<string, Partial<ElementAnimationState>>) {
	return new Map(
		Object.entries(entries).map(([key, value]) => [
			key,
			{ visible: true, ...value } as ElementAnimationState,
		]),
	);
}

describe('buildTextBuildSpec', () => {
	it('returns nothing when no build targets the paragraph', () => {
		expect(buildTextBuildSpec('el', 0, [{ text: 'Hello' }], undefined)).toBeUndefined();
		expect(buildTextBuildSpec('el', 0, [{ text: 'Hello' }], new Map())).toBeUndefined();
		expect(
			buildTextBuildSpec('el', 0, [{ text: 'Hello' }], states({ 'other::c0-0': {} })),
		).toBeUndefined();
	});

	it('splits per character, one span per letter including spaces', () => {
		const spec = buildTextBuildSpec(
			'el',
			0,
			[{ text: 'Hi there' }],
			states({ 'el::c0-0': { visible: false }, 'el::c0-1': { cssAnimation: 'fade 400ms' } }),
		);
		expect(spec?.granularity).toBe('char');
		expect(spec?.spans).toHaveLength('Hi there'.length);
		expect(spec?.spans?.[0]).toStrictEqual({
			animId: 'el::c0-0',
			text: 'H',
			hidden: true,
			cssAnimation: undefined,
			style: undefined,
		});
		expect(spec?.spans?.[1].cssAnimation).toBe('fade 400ms');
		// Rejoining the spans must reproduce the paragraph exactly.
		expect(spec?.spans?.map((s) => s.text).join('')).toBe('Hi there');
	});

	// Whitespace stays unanimated so the paragraph still wraps normally.
	it('splits per word and leaves the gaps between words alone', () => {
		const spec = buildTextBuildSpec('el', 0, [{ text: 'one two' }], states({ 'el::w0-0': {} }));
		expect(spec?.granularity).toBe('word');
		expect(spec?.spans?.map((s) => s.text)).toStrictEqual(['one', ' ', 'two']);
		expect(spec?.spans?.[1].animId).toBeUndefined();
		expect(spec?.spans?.[2].animId).toBe('el::w0-1');
	});

	it('wraps the whole paragraph for a paragraph build', () => {
		const spec = buildTextBuildSpec(
			'el',
			2,
			[{ text: 'Body' }],
			states({ 'el::p2': { visible: false, cssAnimation: 'fade 500ms' } }),
		);
		expect(spec).toStrictEqual({
			granularity: 'paragraph',
			animId: 'el::p2',
			hidden: true,
			cssAnimation: 'fade 500ms',
		});
	});

	it('keys spans by the paragraph index they belong to', () => {
		const spec = buildTextBuildSpec('el', 3, [{ text: 'ab' }], states({ 'el::c3-0': {} }));
		expect(spec?.spans?.map((s) => s.animId)).toStrictEqual(['el::c3-0', 'el::c3-1']);
	});
});

describe('textBuildSpanStyle', () => {
	it('always keeps the wrapper inline so text layout is unchanged', () => {
		expect(textBuildSpanStyle({})).toStrictEqual({ display: 'inline' });
	});

	it('hides a piece that has not entered yet and applies its animation', () => {
		expect(textBuildSpanStyle({ hidden: true, cssAnimation: 'fade 400ms' })).toStrictEqual({
			display: 'inline',
			visibility: 'hidden',
			animation: 'fade 400ms',
		});
	});
});

// A build splits the text but must not flatten its formatting.
describe('buildTextBuildSpec - run styles', () => {
	it('carries the style of each run onto the characters it produced', () => {
		const spec = buildTextBuildSpec(
			'el',
			0,
			[
				{ text: 'ab', style: { bold: true } },
				{ text: 'c', style: { bold: false } },
			],
			states({ 'el::c0-0': {} }),
		);
		expect(spec?.spans?.map((s) => s.style)).toStrictEqual([
			{ bold: true },
			{ bold: true },
			{ bold: false },
		]);
	});

	it('keeps a word styled by the run it starts in', () => {
		const spec = buildTextBuildSpec(
			'el',
			0,
			[
				{ text: 'he', style: 'A' },
				{ text: 'llo world', style: 'B' },
			],
			states({ 'el::w0-0': {} }),
		);
		expect(spec?.spans?.map((s) => [s.text, s.style])).toStrictEqual([
			['hello', 'A'],
			[' ', 'B'],
			['world', 'B'],
		]);
	});
});
