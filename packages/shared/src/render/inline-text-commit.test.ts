import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildInlineTextCommitPatch } from './inline-text-commit';
import { applyAutoCorrect } from './options/autocorrect';
import { DEFAULT_VIEWER_OPTIONS } from './options/viewer-options';
import { buildParagraphs } from './text-paragraphs';

function textElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'tx_1',
		type: 'text',
		x: 0,
		y: 0,
		width: 300,
		height: 40,
		text: 'Hello',
		...overrides,
	} as PptxElement;
}

describe('buildInlineTextCommitPatch', () => {
	it('commits current semantic runs instead of redistributing onto the original runs', () => {
		const element = textElement({ textSegments: [{ text: 'Hello', style: { fontSize: 20 } }] });
		const snapshot = {
			elementId: element.id,
			text: 'Hello\nNew item',
			textSegments: [
				{ text: 'Hello', style: { fontSize: 20 } },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: 'New item', style: { fontSize: 28 }, paragraphLevel: 1 },
			],
		};
		expect(
			buildInlineTextCommitPatch(element, snapshot.text, snapshot)?.textSegments,
		).toStrictEqual(snapshot.textSegments);
	});

	it('records semantic changes even when the authored text is unchanged', () => {
		const element = textElement({
			textSegments: [{ text: 'Hello', style: {}, bulletInfo: { char: '•' } }],
		});
		const snapshot = {
			elementId: element.id,
			text: 'Hello',
			textSegments: [{ text: 'Hello', style: {}, bulletInfo: { none: true } }],
		};
		expect(buildInlineTextCommitPatch(element, 'Hello', snapshot)?.textSegments).toStrictEqual(
			snapshot.textSegments,
		);
	});

	it('keeps an untouched list snapshot a no-op without serializing display markers as body', () => {
		const textSegments: TextSegment[] = [
			{ text: '• ', style: {}, bulletInfo: { char: '•' } },
			{ text: 'Hello', style: { fontSize: 24 } },
		];
		const element = textElement({ text: '• Hello', textSegments });
		expect(
			buildInlineTextCommitPatch(element, 'Hello', {
				elementId: element.id,
				text: 'Hello',
				textSegments: structuredClone(textSegments),
			}),
		).toBeUndefined();
	});

	it('rejects a snapshot belonging to another element', () => {
		const element = textElement({ textSegments: [{ text: 'Hello', style: { fontSize: 20 } }] });
		const snapshot = {
			elementId: 'other',
			text: 'Edited',
			textSegments: [{ text: 'Edited', style: { fontSize: 99 } }],
		};
		expect(buildInlineTextCommitPatch(element, 'Edited', snapshot)).toStrictEqual(
			buildInlineTextCommitPatch(element, 'Edited'),
		);
	});

	it('applies AutoCorrect to current snapshot styles rather than the original element', () => {
		const element = textElement({ textSegments: [{ text: 'Old', style: { fontSize: 20 } }] });
		const snapshot = {
			elementId: element.id,
			text: 'hello',
			textSegments: [{ text: 'hello', style: { fontSize: 28 } }],
		};
		expect(buildInlineTextCommitPatch(element, 'Hello', snapshot)?.textSegments).toStrictEqual([
			{ text: 'Hello', style: { fontSize: 28 } },
		]);
	});

	it('preserves exact middle paragraphs when default AutoCorrect also changes the final body', () => {
		const bodies = ['Roman parent third', 'Nested third', 'Nested fourth', '1. literal body'];
		const levels = [0, 1, 1, 0];
		const original: TextSegment[] = bodies.flatMap((body, index) => [
			...(index ? [{ text: '\n', style: {}, isParagraphBreak: true }] : []),
			{
				text: body,
				style: { fontSize: 22 },
				paragraphLevel: levels[index],
				bulletInfo: {
					autoNumType: 'romanUcPeriod',
					autoNumStartAt: 3,
					paragraphIndex: index > 1 ? 1 : 0,
				},
				paragraphProperties: { paragraphSpacingAfter: 10 + index },
			},
		]);
		const element = textElement({ text: bodies.join('\n'), textSegments: original });
		const text = applyAutoCorrect(
			[bodies[0], 'Inserted parent', ...bodies.slice(1)].join('\n'),
			DEFAULT_VIEWER_OPTIONS.proofing,
		);
		expect(text).toContain('1. Literal body');
		const patch = buildInlineTextCommitPatch(element, text)!;
		const result = { ...element, ...patch };
		const segments = result.textSegments!.filter((segment) => !segment.isParagraphBreak);
		expect(segments.map((segment) => segment.paragraphLevel)).toStrictEqual([0, 0, 1, 1, 0]);
		expect(segments[1].bulletInfo).toStrictEqual({ ...original[0].bulletInfo, paragraphIndex: 1 });
		expect(segments[1].paragraphProperties).toBeUndefined();
		expect(segments[1].endParaRunProperties).toBeUndefined();
		expect(segments[1].paragraphInsertionStyle).toBeUndefined();
		expect(segments[2]).toStrictEqual(original[2]);
		expect(segments[3]).toStrictEqual(original[4]);
		expect(segments[4].paragraphProperties).toStrictEqual(original[6].paragraphProperties);
		expect(buildParagraphs(result).map((paragraph) => paragraph.bulletMarker)).toStrictEqual([
			'III.',
			'IV.',
			'III.',
			'IV.',
			'V.',
		]);
	});

	it('skips an unchanged rich-text commit', () => {
		const element = textElement({
			text: 'Alpha Beta\nBulleted item',
			textSegments: [
				{ text: 'Alpha ', style: { bold: true } },
				{ text: 'Beta', style: { italic: true } },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: 'Bulleted item', style: {}, bulletInfo: { char: '•' } },
			],
		});

		expect(buildInlineTextCommitPatch(element, 'Alpha Beta\nBulleted item')).toBeUndefined();
	});

	it('preserves rich runs and paragraph metadata while changing text', () => {
		const bulletInfo = { char: '•' };
		const paragraphProperties = { paragraphSpacingBefore: 8 };
		const element = textElement({
			text: 'Alpha Beta\nBulleted item',
			textSegments: [
				{ text: 'Alpha ', style: { bold: true } },
				{ text: 'Beta', style: { italic: true } },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{
					text: 'Bulleted item',
					style: { underline: true },
					bulletInfo,
					paragraphLevel: 1,
					paragraphProperties,
				},
			],
		});

		const patch = buildInlineTextCommitPatch(element, 'Alpha expanded Beta\nBulleted item edited');
		const segments = (patch as typeof element).textSegments!;

		expect(segments.map((segment) => segment.text)).toStrictEqual([
			'Alpha ',
			'expanded Beta',
			'\n',
			'Bulleted item edited',
		]);
		expect(segments[0].style.bold).toBeTruthy();
		expect(segments[1].style.italic).toBeTruthy();
		expect(segments[3].style.underline).toBeTruthy();
		expect(segments[3].bulletInfo).toBe(bulletInfo);
		expect(segments[3].paragraphLevel).toBe(1);
		expect(segments[3].paragraphProperties).toBe(paragraphProperties);
	});
});
