/**
 * Hyperlink + inline-equation runs on the shared paragraph model.
 *
 * These pin the two facts `buildParagraphs` used to drop. Before this,
 * `ParagraphRun` was `{ text, style }`, so a hyperlinked run reached Vue,
 * Svelte and Vanilla as ordinary text (the link was gone, with nothing in the
 * DOM to notice), and an inline `m:oMath` segment was skipped outright by the
 * builder's `if (text)` guard because an equation run's `a:t` is empty.
 *
 * Angular alone rendered both, via a text-prefix walk that re-attached the
 * metadata to shared's split runs by matching their characters
 * (`paragraph-view.ts`); `segmentIndex` replaces that walk, so it is pinned here
 * too.
 */
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildParagraphs } from './text-paragraphs';
import { resolveRunHyperlink } from './text-run-meta';

function textEl(segments: TextSegment[], extra: Record<string, unknown> = {}): PptxElement {
	return {
		id: 't1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 80,
		textSegments: segments,
		...extra,
	} as unknown as PptxElement;
}

describe('resolveRunHyperlink', () => {
	it('returns undefined for a run with no link', () => {
		expect(resolveRunHyperlink(undefined)).toBeUndefined();
		expect(resolveRunHyperlink({ bold: true })).toBeUndefined();
	});

	it('resolves a safe external target to a renderable href', () => {
		expect(
			resolveRunHyperlink({ hyperlink: 'https://example.com/a', hyperlinkTooltip: 'Docs' }),
		).toStrictEqual({
			url: 'https://example.com/a',
			href: 'https://example.com/a',
			tooltip: 'Docs',
		});
	});

	it('keeps an unsafe target out of the href but still reports the url', () => {
		const link = resolveRunHyperlink({ hyperlink: `${'javascript'}:alert(1)` });
		expect(link?.href).toBeUndefined();
		expect(link?.url).toBe(`${'javascript'}:alert(1)`);
	});

	it('encodes the target slide on an internal ppaction jump and leaves href unset', () => {
		expect(
			resolveRunHyperlink({
				hyperlink: 'ppaction://hlinksldjump',
				hyperlinkTargetSlideIndex: 4,
			}),
		).toStrictEqual({
			url: 'ppaction://hlinksldjump?slideIndex=4',
			targetSlideIndex: 4,
		});
	});

	it('falls back to a:hlinkMouseOver and flags it as hover-activated', () => {
		expect(resolveRunHyperlink({ hyperlinkMouseOver: 'https://example.com/h' })).toStrictEqual({
			url: 'https://example.com/h',
			href: 'https://example.com/h',
			onHover: true,
		});
	});

	it('prefers a:hlinkClick when a run authors both', () => {
		const link = resolveRunHyperlink({
			hyperlink: 'https://example.com/click',
			hyperlinkMouseOver: 'https://example.com/hover',
		});
		expect(link?.url).toBe('https://example.com/click');
		expect(link?.onHover).toBeUndefined();
	});
});

describe('buildParagraphs run metadata', () => {
	it('carries the hyperlink onto EVERY word-split piece of the run', () => {
		// The metric split is what made this non-trivial: one authored run becomes
		// several sibling runs, and the link has to survive on all of them or the
		// second word of a linked phrase stops being a link.
		const paras = buildParagraphs(
			textEl([
				{ text: 'read the docs', style: { fontSize: 18, hyperlink: 'https://example.com' } },
			]),
		);
		const runs = paras[0].runs;
		expect(runs.map((run) => run.text).join('')).toBe('read the docs');
		expect(runs.every((run) => run.hyperlink?.href === 'https://example.com')).toBeTruthy();
	});

	it('leaves a plain run with no hyperlink field at all', () => {
		const [para] = buildParagraphs(textEl([{ text: 'plain', style: {} }]));
		expect(para.runs[0].hyperlink).toBeUndefined();
	});

	it('emits an inline equation run even though its text is empty', () => {
		const paras = buildParagraphs(
			textEl([
				{ text: 'before ', style: {} },
				{ text: '', style: {}, equationXml: { 'm:r': { 'm:t': 'x' } }, equationNumber: '1' },
				{ text: ' after', style: {} },
			]),
		);
		const runs = paras[0].runs;
		const at = runs.findIndex((run) => run.equation);
		expect(at).toBeGreaterThan(0);
		expect(runs[at].equation).toStrictEqual({ xml: { 'm:r': { 'm:t': 'x' } }, number: '1' });
		// Position matters: the maths sits between the runs it was authored between.
		expect(
			runs
				.slice(0, at)
				.map((r) => r.text)
				.join(''),
		).toBe('before ');
		expect(
			runs
				.slice(at + 1)
				.map((r) => r.text)
				.join(''),
		).toBe(' after');
	});

	it('keeps a paragraph whose only content is an equation', () => {
		// Its runs used to be empty, so the trailing-blank-paragraph trim dropped
		// it and a slide that ends on a formula rendered nothing.
		const paras = buildParagraphs(
			textEl([
				{ text: 'intro', style: {} },
				{ text: '\n', style: {} },
				{ text: '', style: {}, equationXml: { 'm:r': { 'm:t': 'y' } } },
			]),
		);
		expect(paras).toHaveLength(2);
		expect(paras[1].runs[0].equation?.xml).toStrictEqual({ 'm:r': { 'm:t': 'y' } });
		expect(paras[1].isEmpty).toBeUndefined();
	});

	it('maps every run back to its source segment and character offset', () => {
		const paras = buildParagraphs(
			textEl([
				{ text: 'one two', style: { fontSize: 12 } },
				{ text: '\n', style: {} },
				{ text: 'three', style: { fontSize: 12 } },
			]),
		);
		expect(paras[0].runs.every((run) => run.segmentIndex === 0)).toBeTruthy();
		// The offsets tile the segment's rendered text with no gaps or overlaps.
		let expected = 0;
		for (const run of paras[0].runs) {
			expect(run.charStart).toBe(expected);
			expected += run.text.length;
		}
		expect(expected).toBe('one two'.length);
		expect(paras[1].runs.every((run) => run.segmentIndex === 2)).toBeTruthy();
	});

	it('numbers segments against the OVERRIDE list when one is supplied', () => {
		// Linked text boxes paint a slice of the chain, so the index has to be into
		// what was rendered, not into the element's own segments.
		const el = textEl([{ text: 'unused', style: {} }]);
		const paras = buildParagraphs(el, undefined, [
			{ text: 'a', style: {} },
			{ text: 'b', style: { hyperlink: 'https://example.com' } },
		]);
		expect(paras[0].runs.map((run) => run.segmentIndex)).toStrictEqual([0, 1]);
		expect(paras[0].runs[1].hyperlink?.href).toBe('https://example.com');
	});
});
