/**
 * bullet-toggle.test.ts: the ribbon Bullets / Numbering buttons must author a
 * real `bulletInfo` (what the renderer and save writer read), not the inert
 * `TextStyle.listType` every binding used to write.
 */

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveParagraphBullet } from './bullet-list';
import {
	bulletInfoForKind,
	elementBulletKind,
	isBulletMarkerSegment,
	paragraphBulletKind,
	setElementBullets,
	toggleElementBullets,
	toggleParagraphBullet,
} from './bullet-toggle';
import { remapTextToSegments } from './remap-text';
import { applyListStyleUpdate } from './text-list-style-update';
import { buildParagraphs } from './text-paragraphs';

const seg = (text: string, extra: Partial<TextSegment> = {}): TextSegment => ({
	text,
	style: { fontSize: 18 },
	...extra,
});

const brk = (): TextSegment => ({ text: '\n', style: {}, isParagraphBreak: true });

/** What core produces on load for a bulleted paragraph: marker + run. */
const loadedBullet = (text: string): TextSegment[] => [
	seg('• ', { bulletInfo: { char: '•' }, paragraphLevel: 1 }),
	seg(text),
];

const textElement = (segments: TextSegment[], listType?: 'bullet' | 'none'): PptxElement =>
	({
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: segments.map((s) => s.text).join(''),
		textStyle: { fontSize: 18, ...(listType ? { listType } : {}) },
		textSegments: segments,
	}) as unknown as PptxElement;

describe('bulletInfoForKind', () => {
	it('keeps a shifted blank paragraph style through a scoped list command and later typing', () => {
		const hint = { fontFamily: 'Courier New', fontSize: 40, bold: true };
		const shifted = remapTextToSegments(
			'Inserted\nFirst\n\nLast',
			[seg('First'), brk(), { ...brk(), paragraphInsertionStyle: hint }, seg('Last')],
			{},
		);
		const listed = setElementBullets(textElement(shifted), 'numbered', {
			startParagraph: 2,
			endParagraph: 2,
		});
		const typed = remapTextToSegments('Inserted\nFirst\nTyped\nLast', listed.textSegments, {});
		expect(typed.find((segment) => segment.text === 'Typed')?.style).toStrictEqual(hint);
		expect(typed.every((segment) => !segment.paragraphInsertionStyle)).toBeTruthy();
	});

	it.each([null, { startSegIdx: 0, startOffset: 0, endSegIdx: 0, endOffset: 0 }])(
		'keeps insertion formatting through scoped list style commands: %j',
		(selection) => {
			const initial = textElement([
				seg('◆ ', {
					bulletInfo: { char: '◆' },
					paragraphInsertionStyle: { fontSize: 40, bold: true, color: '#007000' },
				}),
			]);
			const updates = {
				listType: 'numbered' as const,
				fontSize: 24,
				bold: false,
				color: '#000000',
			};
			const changed = { ...initial, ...applyListStyleUpdate(initial, updates, selection).patch };
			const segments = (changed as { textSegments: TextSegment[] }).textSegments;
			expect(segments).toHaveLength(1);
			expect(segments[0].paragraphInsertionStyle).toMatchObject({
				fontSize: 24,
				bold: false,
				color: '#000000',
			});
			const typed = remapTextToSegments('Typed', segments, {});
			expect(typed.at(-1)?.style).toMatchObject({ fontSize: 24, bold: false, color: '#000000' });
			expect(typed.every((segment) => !segment.paragraphInsertionStyle)).toBeTruthy();
		},
	);

	it.each([
		{
			text: '◆ ',
			kind: 'bullet' as const,
			info: { char: '◆', fontFamily: 'Wingdings', color: '#CC0000' },
		},
		{
			text: 'IV.',
			kind: 'numbered' as const,
			info: {
				autoNumType: 'romanUcPeriod',
				autoNumStartAt: 4,
				paragraphIndex: 0,
				color: '#CC0000',
			},
		},
		{
			text: '',
			kind: 'bullet' as const,
			info: { imageDataUrl: 'data:image/png;base64,AA==', color: '#CC0000' },
		},
	])('preserves authored runless marker metadata through off/on: %j', ({ text, kind, info }) => {
		const hint = { fontFamily: 'Calibri', fontSize: 40 };
		const source = seg(text, { bulletInfo: info, paragraphInsertionStyle: hint });
		const on = toggleParagraphBullet(toggleParagraphBullet([source], 'none'), kind);
		expect(on).toHaveLength(1);
		expect(on[0]).toMatchObject({ text, bulletInfo: info, paragraphInsertionStyle: hint });
		const typed = remapTextToSegments('Typed', on, {});
		expect(typed.at(-1)?.style).toStrictEqual(hint);
		expect(typed.every((segment) => !segment.paragraphInsertionStyle)).toBeTruthy();
	});

	it('keeps runless insertion formatting through list off/on without adding a body run', () => {
		const insertion = { fontFamily: 'Calibri', fontSize: 40, color: '#000000' };
		const original = [
			seg('◆ ', {
				style: { fontFamily: 'Wingdings', color: '#FF0000' },
				bulletInfo: { char: '◆' },
				paragraphInsertionStyle: insertion,
			}),
		];
		const off = toggleParagraphBullet(original, 'none');
		expect(off).toHaveLength(1);
		expect(off[0].text).toBe('');
		expect(off[0].paragraphInsertionStyle).toBe(insertion);
		const on = toggleParagraphBullet(off, 'numbered');
		expect(on).toHaveLength(1);
		expect(on[0].paragraphInsertionStyle).toBe(insertion);
		const typed = remapTextToSegments('Typed', on, {});
		expect(typed.at(-1)?.style).toStrictEqual(insertion);
		expect(typed.every((segment) => !segment.paragraphInsertionStyle)).toBeTruthy();
	});

	it('authors the three OOXML bullet forms', () => {
		expect(bulletInfoForKind('bullet')).toStrictEqual({ char: '•' });
		expect(bulletInfoForKind('numbered', 2)).toStrictEqual({
			autoNumType: 'arabicPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 2,
		});
		expect(bulletInfoForKind('none')).toStrictEqual({ none: true });
	});
});

describe('paragraphBulletKind', () => {
	it('reads the resolved bullet, including one core inherited from the layout', () => {
		expect(paragraphBulletKind(loadedBullet('Item'))).toBe('bullet');
		expect(
			paragraphBulletKind([
				seg('1.', { bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 } }),
				seg('Item'),
			]),
		).toBe('numbered');
		expect(paragraphBulletKind([seg('Plain')])).toBe('none');
		expect(paragraphBulletKind([seg('Off', { bulletInfo: { none: true } })])).toBe('none');
		expect(paragraphBulletKind([])).toBe('none');
	});

	it("honours a style listType of 'none' as suppression", () => {
		const para = [seg('• ', { bulletInfo: { char: '•' }, style: { listType: 'none' } }), seg('X')];
		expect(paragraphBulletKind(para)).toBe('none');
	});
});

describe('toggleParagraphBullet', () => {
	it('turns a plain paragraph into a bullet the renderer draws once', () => {
		const next = toggleParagraphBullet([seg('Item')], 'bullet');
		expect(next).toHaveLength(2);
		expect(next[0].bulletInfo).toStrictEqual({ char: '•' });
		expect(isBulletMarkerSegment(next[0])).toBeTruthy();
		expect(next[1].text).toBe('Item');
		expect(next[1].bulletInfo).toBeUndefined();
		expect(resolveParagraphBullet(next[0])?.marker).toBe('•');
	});

	it('switches a loaded bullet to numbering without leaving the old glyph behind', () => {
		const next = toggleParagraphBullet(loadedBullet('Item'), 'numbered', 1);
		expect(next.map((s) => s.text)).toStrictEqual(['2.', 'Item']);
		expect(next[0].bulletInfo).toStrictEqual({
			autoNumType: 'arabicPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 1,
		});
		expect(resolveParagraphBullet(next[0])?.marker).toBe('2.');
	});

	it('turns a bullet off with an explicit buNone and drops the marker segment', () => {
		const next = toggleParagraphBullet(loadedBullet('Item'), 'none');
		expect(next).toHaveLength(1);
		expect(next[0].text).toBe('Item');
		expect(next[0].bulletInfo).toStrictEqual({ char: '•', none: true });
		expect(paragraphBulletKind(next)).toBe('none');
	});

	it('keeps the paragraph-level fields on whichever segment ends up first', () => {
		const on = toggleParagraphBullet(loadedBullet('Item'), 'numbered');
		expect(on[0].paragraphLevel).toBe(1);
		const off = toggleParagraphBullet(loadedBullet('Item'), 'none');
		expect(off[0].paragraphLevel).toBe(1);
	});

	it("clears the inert listType so a stale 'none' cannot suppress the new marker", () => {
		const next = toggleParagraphBullet([seg('Item', { style: { listType: 'none' } })], 'bullet');
		expect(next[0].style.listType).toBeUndefined();
		expect(next[1].style.listType).toBeUndefined();
		expect(paragraphBulletKind(next)).toBe('bullet');
	});

	it('leaves an empty paragraph alone', () => {
		expect(toggleParagraphBullet([], 'bullet')).toStrictEqual([]);
	});
});

describe('setElementBullets / toggleElementBullets', () => {
	it('keeps same-kind marker styling and authored percentage/body size through live off/on', async () => {
		const paragraphProperties = {
			paragraphSpacingBefore: 6,
			paragraphSpacingAfter: 14,
			lineSpacing: 1.25,
		};
		const seed = {
			...textElement([
				seg('Item', {
					style: { fontSize: 22 },
					bulletInfo: { char: '◆', sizePercent: 75 },
					paragraphProperties,
				}),
			]),
			textStyle: { fontSize: 22 },
		};
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		const bytes = await handler.save([{ ...data.slides[0], elements: [seed], isDirty: true }]);
		const loaded = await new PptxHandler().load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
		const el = loaded.slides[0].elements[0];
		const before = buildParagraphs(el)[0].bulletStyle.fontSize;
		const on = { ...el, ...setElementBullets(el, 'bullet') } as PptxElement;
		expect(buildParagraphs(on)[0].bulletStyle.fontSize).toBe(before);
		const off = { ...on, ...setElementBullets(on, 'none') } as PptxElement;
		const back = { ...off, ...setElementBullets(off, 'bullet') } as PptxElement;
		expect((back as { textSegments: TextSegment[] }).textSegments[0].bulletInfo?.sizePercent).toBe(
			75,
		);
		expect(
			buildParagraphs(back)[0]
				.runs.filter((run) => run.text)
				.map((run) => [run.text, run.style.fontSize]),
		).toStrictEqual([['Item', '22px']]);
		expect(
			(back as { textSegments: TextSegment[] }).textSegments[0].paragraphProperties,
		).toStrictEqual(paragraphProperties);
	});

	it('preserves an authored glyph and formatting across explicit set and live off/on', () => {
		const info = { char: '»', fontFamily: 'Wingdings', sizePercent: 80, color: '#AABBCC' };
		const el = textElement([seg('» ', { bulletInfo: info }), seg('Item')]);
		const on = { ...el, ...setElementBullets(el, 'bullet') } as PptxElement;
		expect(buildParagraphs(on)[0].bulletMarker).toBe('»');
		const off = { ...on, ...setElementBullets(on, 'none') } as PptxElement;
		const back = { ...off, ...setElementBullets(off, 'bullet') } as PptxElement;
		expect((back as { textSegments: TextSegment[] }).textSegments[0].bulletInfo).toStrictEqual(
			info,
		);
		expect(setElementBullets(back, 'bullet')).toStrictEqual(setElementBullets(on, 'bullet'));
	});

	it('does not remove literal numbered text without a runtime marker index', () => {
		const para = [seg('1.', { bulletInfo: { autoNumType: 'arabicPeriod' } }), seg(' Item')];
		expect(toggleParagraphBullet(para, 'none').map((s) => s.text)).toStrictEqual(['1.', ' Item']);
	});

	it('removes only the leading synthetic marker, not marker-like later content', () => {
		const para = [...loadedBullet('Item'), seg('• ', { bulletInfo: { char: '•' } })];
		expect(toggleParagraphBullet(para, 'none').map((s) => s.text)).toStrictEqual(['Item', '• ']);
	});

	it('recognizes a suppressed marker without losing its authored glyph', () => {
		const para = [
			seg('» ', { bulletInfo: { char: '»' }, style: { listType: 'none' } }),
			seg('Item'),
		];
		expect(toggleParagraphBullet(para, 'bullet').map((s) => s.text)).toStrictEqual(['» ', 'Item']);
	});

	it('retains picture bullets and removes their loaded display placeholder on disable', () => {
		const info = {
			imageRelId: 'rId7',
			imageDataUrl: 'data:image/png;base64,AA==',
			imageBlipFillXml: { 'a:blip': { '@_r:embed': 'rId7' }, 'a:stretch': {} },
		};
		const para = [seg('📎 ', { bulletInfo: info }), seg('Item')];
		const on = toggleParagraphBullet(para, 'bullet');
		expect(on[0].bulletInfo).toStrictEqual(info);
		expect(on.map((s) => s.text)).toStrictEqual(['Item']);
		expect(buildParagraphs(textElement(on))[0].runs.map((run) => run.text)).toStrictEqual(['Item']);
		expect(toggleParagraphBullet(on, 'none').map((s) => s.text)).toStrictEqual(['Item']);
	});

	it('turns off a marker-only paragraph while retaining its paragraph metadata', () => {
		const para = [
			seg('• ', {
				bulletInfo: { char: '•' },
				paragraphLevel: 2,
				paragraphProperties: { paragraphSpacingAfter: 12 },
			}),
		];
		const next = toggleParagraphBullet(para, 'none');
		expect(next[0].text).toBe('');
		expect(next[0].bulletInfo?.none).toBeTruthy();
		expect(next[0].paragraphLevel).toBe(2);
		expect(next[0].paragraphProperties).toStrictEqual({ paragraphSpacingAfter: 12 });
	});

	it('uses the core per-level numbering sequence instead of a flat ordinal', () => {
		const el = textElement([
			seg('A', { paragraphLevel: 0 }),
			brk(),
			seg('B', { paragraphLevel: 1 }),
			brk(),
			seg('C', { paragraphLevel: 1 }),
			brk(),
			seg('D', { paragraphLevel: 0 }),
		]);
		const next = { ...el, ...setElementBullets(el, 'numbered') } as PptxElement;
		expect(buildParagraphs(next).map((p) => p.bulletMarker)).toStrictEqual([
			'1.',
			'1.',
			'2.',
			'2.',
		]);
	});

	it('preserves a numbered list scheme and custom start on explicit set', () => {
		const el = textElement([
			seg('IV.', {
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 4, paragraphIndex: 0 },
			}),
			seg('Item'),
		]);
		const next = { ...el, ...setElementBullets(el, 'numbered') } as PptxElement;
		expect(buildParagraphs(next)[0].bulletMarker).toBe('IV.');
	});

	it('does not add text properties to a non-text element', () => {
		expect(setElementBullets({ type: 'image', id: 'i' } as PptxElement, 'bullet')).toStrictEqual(
			{},
		);
	});

	it('only changes requested paragraphs but updates downstream derived numbering', () => {
		const plain = textElement([seg('A'), brk(), seg('B'), brk(), seg('C')]);
		const numbered = { ...plain, ...setElementBullets(plain, 'numbered') } as PptxElement;
		const off = {
			...numbered,
			...setElementBullets(numbered, 'none', { startParagraph: 1, endParagraph: 1 }),
		} as PptxElement;
		expect(buildParagraphs(off).map((p) => p.bulletMarker)).toStrictEqual(['1.', undefined, '1.']);
		const on = {
			...off,
			...setElementBullets(off, 'numbered', { startParagraph: 1, endParagraph: 1 }),
		} as PptxElement;
		expect(buildParagraphs(on).map((p) => p.bulletMarker)).toStrictEqual(['1.', '2.', '3.']);
		expect(buildParagraphs(on).map((p) => p.runs.map((r) => r.text).join(''))).toStrictEqual([
			'A',
			'B',
			'C',
		]);
	});

	it('keeps unselected paragraph properties and run identity for ordinary bullet edits', () => {
		const before = seg('Untouched', { paragraphProperties: { paragraphSpacingBefore: 8 } });
		const after = seg('Also untouched');
		const el = textElement([before, brk(), seg('Edit'), brk(), after]);
		const patch = setElementBullets(el, 'bullet', { startParagraph: 1, endParagraph: 1 }) as {
			textSegments: TextSegment[];
		};
		expect(patch.textSegments[0]).toBe(before);
		expect(patch.textSegments.at(-1)).toBe(after);
		expect(
			buildParagraphs({ ...el, ...patch } as PptxElement).map((p) => p.bulletMarker),
		).toStrictEqual([undefined, '•', undefined]);
	});

	it('retains soft breaks, empty paragraphs and separator-carried geometry', () => {
		const empty = {
			...brk(),
			paragraphLevel: 2,
			paragraphProperties: { paragraphSpacingAfter: 10 },
		};
		const el = textElement([
			seg('First'),
			seg('\n', { isLineBreak: true }),
			seg('line'),
			brk(),
			empty,
			seg('Last'),
			brk(),
		]);
		const patch = setElementBullets(el, 'bullet') as { textSegments: TextSegment[] };
		expect(patch.textSegments.filter((s) => s.isParagraphBreak)).toHaveLength(3);
		expect(patch.textSegments.filter((s) => s.isLineBreak)).toHaveLength(1);
		const carrier = patch.textSegments.find((s) => s.text === '• ' && s.paragraphLevel === 2);
		expect(carrier?.paragraphProperties).toStrictEqual({ paragraphSpacingAfter: 10 });
		expect(patch.textSegments.filter((s) => s.text === '• ')).toHaveLength(4);
	});

	it('does not mutate source runs or their bullet definitions', () => {
		const info = Object.freeze({ char: '»', sizePercent: 80 });
		const marker = Object.freeze(seg('» ', { bulletInfo: info }));
		const body = Object.freeze(seg('Item'));
		const el = textElement([marker, body]);
		setElementBullets(el, 'none');
		expect(marker.bulletInfo).toBe(info);
		expect(info).toStrictEqual({ char: '»', sizePercent: 80 });
	});

	it('writes native custom bullets and buNone without display glyphs in saved body text', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		const el = textElement([
			seg('» ', {
				bulletInfo: { char: '»', fontFamily: 'Arial', sizePercent: 90 },
				paragraphProperties: { paragraphSpacingAfter: 12 },
			}),
			seg('Item'),
		]);
		let current = { ...el, ...setElementBullets(el, 'bullet') } as PptxElement;
		async function saveAndReload(): Promise<{ xml: string; element: PptxElement }> {
			const bytes = await handler.save([{ ...data.slides[0], isDirty: true, elements: [current] }]);
			const zip = await JSZip.loadAsync(bytes);
			const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
			const loaded = await new PptxHandler().load(
				bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
			);
			return {
				xml,
				element:
					loaded.slides[0].elements.find((candidate) => candidate.id === 't1') ??
					loaded.slides[0].elements[0],
			};
		}
		const on = await saveAndReload();
		expect(on.xml).toContain('<a:buChar char="»"');
		expect(on.xml).toContain('<a:t>Item</a:t>');
		expect(on.xml).not.toContain('<a:t>»');
		expect(buildParagraphs(on.element)[0].bulletMarker).toBe('»');
		current = { ...current, ...setElementBullets(current, 'none') } as PptxElement;
		const off = await saveAndReload();
		expect(off.xml).toContain('<a:buNone');
		expect(off.xml).not.toContain('<a:buChar');
		expect(buildParagraphs(off.element)[0].bulletMarker).toBeUndefined();
		expect(
			buildParagraphs(off.element)[0]
				.runs.map((r) => r.text)
				.join(''),
		).toBe('Item');
	});

	it('numbers every paragraph consecutively and clears the element listType', () => {
		const el = textElement([seg('A'), brk(), seg('B'), brk(), seg('C')], 'none');
		const patch = setElementBullets(el, 'numbered');
		const segments = (patch as { textSegments: TextSegment[] }).textSegments;
		const markers = segments.filter((s) => isBulletMarkerSegment(s)).map((s) => s.text);
		expect(markers).toStrictEqual(['1.', '2.', '3.']);
		expect((patch as { textStyle: { listType?: string } }).textStyle.listType).toBeUndefined();
		// Separators survive so the paragraph count is unchanged.
		expect(segments.filter((s) => s.isParagraphBreak)).toHaveLength(2);
	});

	it('renders through buildParagraphs with one marker per paragraph and the runs intact', () => {
		const el = textElement([seg('A'), brk(), seg('B')]);
		const next = { ...el, ...setElementBullets(el, 'bullet') } as PptxElement;
		const paragraphs = buildParagraphs(next);
		expect(paragraphs).toHaveLength(2);
		for (const [i, para] of paragraphs.entries()) {
			expect(para.bulletMarker).toBe('•');
			expect(para.runs.map((r) => r.text).join('')).toBe(i === 0 ? 'A' : 'B');
		}
	});

	it('toggles off when the element is already in that state, on otherwise', () => {
		const el = textElement([...loadedBullet('A'), brk(), ...loadedBullet('B')]);
		expect(elementBulletKind(el)).toBe('bullet');
		const off = { ...el, ...toggleElementBullets(el, 'bullet') } as PptxElement;
		expect(elementBulletKind(off)).toBe('none');
		const numbered = { ...el, ...toggleElementBullets(el, 'numbered') } as PptxElement;
		expect(elementBulletKind(numbered)).toBe('numbered');
		const back = { ...numbered, ...toggleElementBullets(numbered, 'bullet') } as PptxElement;
		expect(elementBulletKind(back)).toBe('bullet');
	});

	it('synthesises segments for an element that only carries text', () => {
		const el = {
			type: 'text',
			id: 't2',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			text: 'One\nTwo',
			textStyle: { fontSize: 14 },
		} as unknown as PptxElement;
		const patch = setElementBullets(el, 'bullet');
		const segments = (patch as { textSegments: TextSegment[] }).textSegments;
		expect(segments.map((s) => s.text)).toStrictEqual(['• ', 'One', '\n', '• ', 'Two']);
	});
});
