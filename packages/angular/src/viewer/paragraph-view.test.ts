/**
 * The Angular paragraph view model, now built from shared `buildParagraphs`.
 *
 * This binding used to carry a ~190-line hand-ported copy of that builder
 * inside `element-renderer.component.ts` (self-documented as "hand-ported from
 * `buildParagraphs`"), and it had already drifted. These tests pin the two
 * halves of the swap:
 *
 *  1. the drift the copy had (a bullet on a paragraph with no visible text) is
 *     gone, because the rule lives in shared;
 *  2. the two things this binding renders that shared's `ParagraphRun` did not
 *     used to model (a run hyperlink, an inline equation) still reach the
 *     template now that they come off the shared run instead of the segment
 *     walk this module used to run over shared's output.
 */
import type { PptxElement, PptxElementWithText, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildParagraphs } from '../internal/shared';
import { buildAngularParagraphs } from './paragraph-view';

function textElement(segments: TextSegment[], extra: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		textStyle: { fontSize: 16 },
		textSegments: segments,
		...extra,
	} as PptxElementWithText as PptxElement;
}

/** The load path's paragraph separator. */
const BREAK: TextSegment = { text: '\n', style: {} };

describe('buildAngularParagraphs', () => {
	it('is a pure projection of the shared builder for plain text', () => {
		const element = textElement([
			{ text: 'First', style: { fontSize: 16 } },
			BREAK,
			{ text: 'Second', style: { fontSize: 16 } },
		]);
		const shared = buildParagraphs(element);
		const angular = buildAngularParagraphs(element);

		expect(angular).toHaveLength(shared.length);
		expect(angular.map((p) => p.runs.map((r) => r.text).join(''))).toStrictEqual(
			shared.map((p) => p.runs.map((r) => r.text).join('')),
		);
		// Field-for-field, only the key names differ (`marginLeftPx` → `indentPx`).
		expect(angular[0].indentPx).toBe(shared[0].marginLeftPx ?? 0);
		expect(angular[0].runs[0].style).toStrictEqual(shared[0].runs[0].style);
		expect(angular[0].runs[0].href).toBeUndefined();
	});

	// The drift the audit found in the hand-ported copy: it resolved and applied
	// the bullet unconditionally on the paragraph's first segment, with no
	// equivalent of shared's `hasVisibleTextContent` check, so a whitespace-only
	// paragraph painted a stray bullet here and nothing in the other four.
	it('suppresses the bullet on a paragraph with no visible text', () => {
		const element = textElement([
			{ text: '• ', style: { fontSize: 16 }, bulletInfo: { char: '•' } },
			{ text: '   ', style: { fontSize: 16 } },
		]);
		const [para] = buildAngularParagraphs(element);
		expect(para.bulletMarker).toBeUndefined();
		expect(para.bulletPicture).toBeUndefined();
	});

	it('still marks a real list item', () => {
		const element = textElement([
			{ text: '• ', style: { fontSize: 16 }, bulletInfo: { char: '•' } },
			{ text: 'Item one', style: { fontSize: 16 } },
		]);
		const [para] = buildAngularParagraphs(element);
		expect(para.bulletMarker).toBe('•');
		// The dedicated marker segment is dropped from the runs (rendered once).
		expect(para.runs.map((r) => r.text).join('')).toBe('Item one');
	});

	it('keeps an authored blank line so its vertical gap survives', () => {
		const element = textElement([
			{ text: 'Heading', style: { fontSize: 24 } },
			BREAK,
			BREAK,
			{ text: 'Body', style: { fontSize: 16 } },
		]);
		const paragraphs = buildAngularParagraphs(element);
		expect(paragraphs).toHaveLength(3);
		expect(paragraphs[1].isEmpty).toBeTruthy();
	});
});

describe('buildAngularParagraphs - run hyperlinks', () => {
	it('hands each run of a linked segment its href and tooltip', () => {
		const element = textElement([
			{ text: 'See ', style: { fontSize: 16 } },
			{
				text: 'the docs',
				style: {
					fontSize: 16,
					hyperlink: 'https://example.com/docs',
					hyperlinkTooltip: 'Documentation',
				},
			},
			{ text: ' now', style: { fontSize: 16 } },
		]);
		const [para] = buildAngularParagraphs(element);
		const linked = para.runs.filter((run) => run.href !== undefined);
		expect(linked.length).toBeGreaterThan(0);
		// Shared splits a run per word for metric tracking, so every piece of the
		// linked segment - and only those pieces - has to carry the href.
		expect(linked.map((run) => run.text).join('')).toBe('the docs');
		expect(linked.every((run) => run.href === 'https://example.com/docs')).toBeTruthy();
		expect(linked[0].tooltip).toBe('Documentation');
		expect(para.runs.map((run) => run.text).join('')).toBe('See the docs now');
	});

	it('does not leak the href onto the neighbouring plain runs', () => {
		const element = textElement([
			{ text: 'Home', style: { fontSize: 16, hyperlink: 'https://example.com' } },
			{ text: ' and away', style: { fontSize: 16 } },
		]);
		const [para] = buildAngularParagraphs(element);
		const plain = para.runs.filter((run) => run.href === undefined);
		expect(plain.map((run) => run.text).join('')).toBe(' and away');
	});

	it('links a run that follows the bullet-marker segment shared drops', () => {
		const element = textElement([
			{ text: '• ', style: { fontSize: 16 }, bulletInfo: { char: '•' } },
			{ text: 'Linked item', style: { fontSize: 16, hyperlink: 'https://example.com' } },
		]);
		const [para] = buildAngularParagraphs(element);
		expect(para.bulletMarker).toBe('•');
		expect(para.runs.every((run) => run.href === 'https://example.com')).toBeTruthy();
	});

	it('drops a javascript: href rather than rendering it', () => {
		const element = textElement([
			// eslint-disable-next-line no-script-url
			{ text: 'Bad', style: { fontSize: 16, hyperlink: 'javascript:alert(1)' } },
		]);
		const [para] = buildAngularParagraphs(element);
		expect(para.runs.every((run) => run.href === undefined)).toBeTruthy();
	});
});

describe('buildAngularParagraphs - inline equations', () => {
	const omml = { 'm:oMath': { 'm:r': { 'm:t': 'x' } } };

	it('re-inserts an equation run shared drops for having no text', () => {
		const element = textElement([{ text: '', style: {}, equationXml: omml }]);
		const [para] = buildAngularParagraphs(element);
		expect(para.runs).toHaveLength(1);
		expect(para.runs[0].equationXml).toStrictEqual(omml);
		// It is content, so the paragraph must not also render the blank-line <br>.
		expect(para.isEmpty).toBeUndefined();
	});

	it('keeps an equation that follows text in the same paragraph, in order', () => {
		const element = textElement([
			{ text: 'Given ', style: { fontSize: 16 } },
			{ text: '', style: {}, equationXml: omml, equationNumber: '(1)' },
			{ text: ' holds', style: { fontSize: 16 } },
		]);
		const [para] = buildAngularParagraphs(element);
		const kinds = para.runs.map((run) => (run.equationXml ? 'eq' : run.text));
		expect(kinds.join('|')).toContain('eq');
		expect(kinds.indexOf('eq')).toBeGreaterThan(0);
		expect(kinds.indexOf('eq')).toBeLessThan(kinds.length - 1);
		expect(para.runs.find((run) => run.equationXml)?.equationNumber).toBe('(1)');
	});

	it('keeps a TRAILING equation paragraph', () => {
		const element = textElement([
			{ text: 'Intro', style: { fontSize: 16 } },
			BREAK,
			{ text: '', style: {}, equationXml: omml },
		]);
		// Shared used to trim this paragraph as blank (an equation segment has no
		// text, so it produced no runs) and this binding re-added it. The equation
		// is a real run now, so shared keeps it and all five bindings agree.
		expect(buildParagraphs(element)).toHaveLength(2);
		const paragraphs = buildAngularParagraphs(element);
		expect(paragraphs).toHaveLength(2);
		expect(paragraphs[1].runs[0].equationXml).toStrictEqual(omml);
	});
});
