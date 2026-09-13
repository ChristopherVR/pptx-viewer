import JSZip from 'jszip';
// @vitest-environment happy-dom
import type { BulletInfo, TextPptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties, PptxHandler, PresentationBuilder } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { setElementBullets } from './bullet-toggle';
import { inlineListBodyText } from './inline-list-body';
import { transformInlineListCase } from './inline-list-case';
import { reconcileInlineListFormatting } from './inline-list-format';
import { reconcileInlineListSnapshot } from './inline-list-reconcile';
import {
	bindInlineListParagraph,
	bindInlineListRun,
	createInlineListSeed,
	registerInlineListParagraphFormat,
	registerInlineListRunStyle,
} from './inline-list-seed';
import { readInlineListSelection } from './inline-list-selection';
import { readInlineListSnapshot } from './inline-list-snapshot';
import { buildInlineListStylePatch } from './inline-list-style';

function element(segments?: TextSegment[]): TextPptxElement {
	return {
		id: 'target',
		type: 'text',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		textStyle: { fontSize: 20, color: '#333333' },
		textSegments: segments ?? [
			{
				text: 'First',
				style: { fontSize: 32, bold: true, color: '#CC00AA' },
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 3, paragraphIndex: 0 },
				paragraphLevel: 1,
				paragraphProperties: { paragraphSpacingAfter: 18 },
				endParaRunProperties: { '@_lang': 'en-US' },
			},
			{ text: '\n', style: {}, isParagraphBreak: true },
			{
				text: 'Last',
				style: { fontSize: 20 },
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 3, paragraphIndex: 1 },
				paragraphLevel: 1,
				paragraphProperties: { paragraphSpacingAfter: 7 },
			},
		],
	};
}

function mount(source = element()) {
	const seed = createInlineListSeed(source)!;
	const root = document.createElement('div');
	for (const paragraph of seed.paragraphs) {
		const block = document.createElement('div');
		block.dataset.pptxListParagraph = paragraph.token;
		bindInlineListParagraph(seed, block, paragraph.sourceIndex);
		for (const run of paragraph.runs) {
			const span = document.createElement('span');
			span.dataset.pptxListRun = run.token;
			if (run.isLineBreak) {
				span.append(document.createElement('br'));
			} else {
				span.textContent = run.text;
			}
			bindInlineListRun(seed, span, run.segmentIndex);
			block.append(span);
		}
		root.append(block);
	}
	return { seed, root, source };
}

const literalMarkers: Array<{ literal: string; bulletInfo: BulletInfo }> = [
	{
		literal: 'III. ',
		bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 3, paragraphIndex: 0 },
	},
	{
		literal: '1. ',
		bulletInfo: { autoNumType: 'arabicPeriod', autoNumStartAt: 1, paragraphIndex: 0 },
	},
	{ literal: '• ', bulletInfo: { char: '•' } },
];

describe('list editor session snapshots', () => {
	it.each(['III. ', 'Replacement body'])(
		'reads native full-body replacement without run tokens: %s',
		(body) => {
			const { seed, root } = mount(
				element([
					{ text: 'III. ', style: { fontSize: 11 }, bulletInfo: literalMarkers[0].bulletInfo },
					{ text: 'Body', style: { fontSize: 24, fontFamily: 'Arial', color: '#172033' } },
				]),
			);
			root.firstElementChild!.innerHTML = `<font color="#CC00AA" face="Arial, Liberation Sans, Arimo, Helvetica, sans-serif"><span style="letter-spacing: -0.00677083px;">${body}</span></font>`;
			const read = readInlineListSnapshot(seed, root);
			expect(read.kind).toBe('supported');
			if (read.kind !== 'supported') {
				throw new Error(read.reason);
			}
			expect(inlineListBodyText(read.snapshot.textSegments!)).toBe(body);
			expect(read.snapshot.textSegments!.at(-1)!.style).toMatchObject({
				fontSize: 24,
				fontFamily: 'Arial',
				color: '#CC00AA',
			});
		},
	);

	it('uses the validated body descriptor for tokenless native text, not marker style', () => {
		const { seed, root } = mount(
			element([
				{ text: '• ', style: { fontSize: 11 }, bulletInfo: { char: '•' } },
				{ text: 'Body', style: { fontSize: 24, bold: true }, fieldGuid: 'original-field' },
			]),
		);
		root.firstElementChild!.textContent = 'Replacement';
		const read = readInlineListSnapshot(seed, root);
		expect(read.kind).toBe('supported');
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.textSegments![0]).toMatchObject({
			text: 'Replacement',
			style: { fontSize: 24, bold: true },
		});
		expect(read.snapshot.textSegments![0].fieldGuid).toBeUndefined();
	});

	it('does not restore atomic identity when native replacement recreates the same body', () => {
		const { seed, root } = mount(
			element([
				{ text: '• ', style: { fontSize: 11 }, bulletInfo: { char: '•' } },
				{
					text: 'Body',
					style: { fontSize: 24 },
					fieldGuid: 'original-field',
					fieldType: 'slidenum',
				},
			]),
		);
		root.firstElementChild!.textContent = 'Body';
		const read = readInlineListSnapshot(seed, root);
		expect(read.kind).toBe('supported');
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.textSegments!.some((run) => run.fieldGuid || run.fieldType)).toBeFalsy();
	});

	it.each(literalMarkers)(
		'keeps authored $literal text through selection, case and list-off',
		({ literal, bulletInfo }) => {
			const source = element([
				{
					text: literal,
					style: { fontSize: 11 },
					bulletInfo,
					paragraphLevel: 1,
					paragraphProperties: { paragraphSpacingAfter: 12 },
				},
				{ text: 'Body', style: { fontSize: 22, bold: true } },
			]);
			const { seed, root } = mount(source);
			const run = root.querySelector('[data-pptx-list-run]')!;
			run.textContent = literal;
			const read = readInlineListSnapshot(seed, root);
			expect(read.kind).toBe('supported');
			if (read.kind !== 'supported') {
				throw new Error(read.reason);
			}
			expect(read.snapshot.text).toBe(literal);
			expect(inlineListBodyText(read.snapshot.textSegments)).toBe(literal);
			expect(read.snapshot.textSegments?.[0]).toMatchObject({
				style: { fontSize: 11 },
				paragraphProperties: { paragraphSpacingAfter: 12 },
			});
			expect(read.snapshot.textSegments?.[1]).toMatchObject({
				text: literal,
				style: { fontSize: 22, bold: true },
			});
			expect(read.snapshot.textSegments?.[1].bulletInfo).toBeUndefined();
			const off = setElementBullets(
				{ ...source, textSegments: read.snapshot.textSegments },
				'none',
			);
			expect(inlineListBodyText(off.textSegments)).toBe(literal);
			expect(transformInlineListCase(read.snapshot, null, 'lower').text).toBe(
				literal.toLowerCase(),
			);
			expect(
				inlineListBodyText(
					reconcileInlineListSnapshot(read.snapshot, literal.toLowerCase())?.textSegments,
				),
			).toBe(literal.toLowerCase());
			document.body.append(root);
			const selection = window.getSelection()!;
			selection.setBaseAndExtent(run.firstChild!, 0, run.firstChild!, literal.length);
			const selected = readInlineListSelection(seed, root, selection);
			expect(selected).toMatchObject({
				kind: 'supported',
				bodyRange: { start: 0, end: literal.length },
				selection: { startSegIdx: 1, startOffset: 0, endSegIdx: 1, endOffset: literal.length },
			});
			if (selected.kind !== 'supported') {
				throw new Error(selected.reason);
			}
			const patch = buildInlineListStylePatch(
				{ ...source, textSegments: read.snapshot.textSegments },
				{ italic: true },
				selected.selection,
			);
			const formatted = reconcileInlineListFormatting(seed, root, {
				...read.snapshot,
				textSegments: patch?.textSegments,
			});
			expect(formatted.kind).toBe('supported');
			if (formatted.kind === 'supported') {
				expect(inlineListBodyText(formatted.snapshot.textSegments)).toBe(literal);
				expect(formatted.snapshot.textSegments?.[1].style.italic).toBeTruthy();
			}
			root.remove();
			selection.removeAllRanges();
		},
	);

	it.each(literalMarkers)(
		'preserves exact native body $literal on saved-file reopen',
		async ({ literal, bulletInfo }) => {
			const { handler, data, createSlide } = await PresentationBuilder.create();
			const slide = createSlide('Blank')
				.addText('Body', { x: 40, y: 40, width: 400, height: 300 })
				.build();
			const source = slide.elements[0];
			if (!hasTextProperties(source)) {
				throw new Error('Expected text');
			}
			source.textSegments = [{ text: 'Body', style: { fontSize: 22, bold: true }, bulletInfo }];
			data.slides.push(slide);
			const buffer = (bytes: Uint8Array) =>
				bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
			const loader = new PptxHandler();
			const loaded = await loader.load(buffer(await handler.save(data.slides)));
			const shape = loaded.slides[0].elements[0];
			if (shape.type !== 'text') {
				throw new Error('Expected loaded text');
			}
			const { seed, root } = mount(shape);
			root.querySelector('[data-pptx-list-run]')!.textContent = literal;
			const read = readInlineListSnapshot(seed, root);
			if (read.kind !== 'supported') {
				throw new Error(read.reason);
			}
			const saved = await loader.save([
				{
					...loaded.slides[0],
					isDirty: true,
					elements: [
						{ ...shape, text: read.snapshot.text, textSegments: read.snapshot.textSegments },
					],
				},
			]);
			const xml = await (
				await JSZip.loadAsync(saved)
			)
				.file('ppt/slides/slide1.xml')!
				.async('string');
			expect(
				Array.from(xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g), (match) => match[1]).join(''),
			).toBe(literal);
			const reloader = new PptxHandler();
			const reopened = (await reloader.load(buffer(saved))).slides[0].elements[0];
			if (!hasTextProperties(reopened)) {
				throw new Error('Expected reopened text');
			}
			expect(inlineListBodyText(reopened.textSegments)).toBe(literal);
			handler.dispose();
			loader.dispose();
			reloader.dispose();
		},
	);

	it.each(['III. ', 'IV. '])(
		'tests marker collision against the current numbered ordinal for %s',
		(literal) => {
			const source = element([
				{
					text: 'First',
					style: {},
					bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 3, paragraphIndex: 0 },
				},
				{ text: '\n', style: {}, isParagraphBreak: true },
				{
					text: 'Second',
					style: {},
					bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 3, paragraphIndex: 1 },
				},
			]);
			const { seed, root } = mount(source);
			root.lastElementChild!.firstElementChild!.textContent = literal;
			const read = readInlineListSnapshot(seed, root);
			if (read.kind !== 'supported') {
				throw new Error(read.reason);
			}
			expect(inlineListBodyText(read.snapshot.textSegments)).toBe(`First\n${literal}`);
			expect(
				read.snapshot.textSegments?.filter((segment) => segment.text === literal),
			).toHaveLength(literal === 'IV. ' ? 2 : 1);
			const off = setElementBullets(
				{ ...source, textSegments: read.snapshot.textSegments },
				'none',
			);
			expect(inlineListBodyText(off.textSegments)).toBe(`First\n${literal}`);
		},
	);

	it('keeps trailing empty list presentation so the controller can display its marker', () => {
		const source = element([
			{ text: 'Item', style: {}, bulletInfo: { char: '◆' } },
			{ text: '\n', style: {}, isParagraphBreak: true },
			{ text: '', style: {}, bulletInfo: { char: '◆' } },
		]);
		const { seed, root } = mount(source);
		const result = readInlineListSnapshot(seed, root);
		expect(result.kind).toBe('supported');
		if (result.kind !== 'supported') {
			throw new Error(result.reason);
		}
		expect(result.snapshot.text).toBe('Item\n');
		expect(result.snapshot.textSegments).toStrictEqual(source.textSegments);
		expect(result.paragraphs).toHaveLength(2);
		expect(result.paragraphs[1].isEmpty).toBeTruthy();
	});

	it.each([false, true])(
		'clears an inherited decoration across original metric children (partial: %s)',
		(partial) => {
			const source = element([
				{ text: 'One two', style: { fontSize: 20 }, bulletInfo: { char: '◆' } },
			]);
			source.textStyle!.underline = true;
			const seed = createInlineListSeed(source)!;
			const root = document.createElement('div');
			const block = document.createElement('div');
			block.dataset.pptxListParagraph = seed.paragraphs[0].token;
			const run = document.createElement('span');
			run.dataset.pptxListRun = seed.paragraphs[0].runs[0].token;
			run.style.textDecoration = 'underline';
			for (const text of ['One ', 'two']) {
				const child = document.createElement('span');
				child.style.textDecoration = 'underline';
				child.textContent = text;
				run.append(child);
			}
			block.append(run);
			root.append(block);
			bindInlineListParagraph(seed, block, 0);
			bindInlineListRun(seed, run, 0);
			const before = readInlineListSnapshot(seed, root);
			expect(before.kind).toBe('supported');
			if (before.kind !== 'supported') {
				throw new Error(before.reason);
			}
			expect(before.snapshot.textSegments).toStrictEqual(source.textSegments);
			const textSegments = partial
				? [
						{ ...source.textSegments![0], text: 'One ', style: { fontSize: 20, underline: false } },
						{ text: 'two', style: { fontSize: 20 } },
					]
				: [{ ...source.textSegments![0], style: { fontSize: 20, underline: false } }];
			const result = reconcileInlineListFormatting(seed, root, {
				...before.snapshot,
				textSegments,
			});
			expect(result.kind).toBe('supported');
			expect(run.style.textDecoration).toBe('none');
			const children = root.querySelectorAll<HTMLElement>('[data-pptx-list-run]');
			for (const child of children) {
				if (child === run) {
					continue;
				}
				expect(child.style.textDecoration.includes('underline')).toBe(
					partial && child.textContent === 'two',
				);
			}
			if (result.kind === 'supported' && partial) {
				expect(result.snapshot.textSegments?.at(-1)?.style).toStrictEqual({ fontSize: 20 });
			}
		},
	);

	it('formats an empty virtual run and preserves its native caret placeholder', () => {
		const source = element([
			{
				text: '◆ ',
				style: { fontSize: 60 },
				bulletInfo: { char: '◆' },
				paragraphInsertionStyle: { fontSize: 18 },
			},
		]);
		const { seed, root } = mount(source);
		const span = root.firstElementChild!.firstElementChild as HTMLElement;
		const br = document.createElement('br');
		span.replaceChildren(br);
		const before = readInlineListSnapshot(seed, root);
		if (before.kind !== 'supported') {
			throw new Error(before.reason);
		}
		const formatted = {
			...before.snapshot,
			textSegments: before.snapshot.textSegments!.map((segment) => ({
				...segment,
				style: { ...segment.style, fontSize: 28, bold: true },
				paragraphInsertionStyle: segment.paragraphInsertionStyle
					? { ...segment.paragraphInsertionStyle, fontSize: 28, bold: true }
					: undefined,
			})),
		};
		const result = reconcileInlineListFormatting(seed, root, formatted);
		if (result.kind !== 'supported') {
			throw new Error(result.reason);
		}
		expect(span.firstChild).toBe(br);
		expect(span.style.fontSize).toBe('28px');
		expect(result.snapshot.textSegments![0].paragraphInsertionStyle).toMatchObject({
			fontSize: 28,
			bold: true,
		});
		span.textContent = 'New body';
		const typed = readInlineListSnapshot(seed, root);
		if (typed.kind !== 'supported') {
			throw new Error(typed.reason);
		}
		expect(typed.snapshot.textSegments![0].style).toMatchObject({ fontSize: 28, bold: true });
		expect(typed.snapshot.textSegments![0].paragraphInsertionStyle).toBeUndefined();
	});

	it('removes and restores underline on a nested run without a stale ancestor decoration', () => {
		const source = element();
		source.textSegments![0].style.underline = true;
		const { seed, root } = mount(source);
		const outer = root.firstElementChild!.firstElementChild as HTMLElement;
		outer.style.textDecoration = 'underline';
		const inner = document.createElement('span');
		inner.append(outer.firstChild!);
		outer.append(inner);
		const before = readInlineListSnapshot(seed, root);
		if (before.kind !== 'supported') {
			throw new Error(before.reason);
		}
		const off = {
			...before.snapshot,
			textSegments: before.snapshot.textSegments!.map((segment) => ({
				...segment,
				style: { ...segment.style, underline: false },
			})),
		};
		const result = reconcileInlineListFormatting(seed, root, off);
		if (result.kind !== 'supported') {
			throw new Error(result.reason);
		}
		expect(outer.style.textDecoration).toBe('none');
		expect(inner.style.textDecoration).toBe('none');
		expect(result.snapshot.textSegments![0].style.underline).toBeFalsy();
		const restored = reconcileInlineListFormatting(seed, root, before.snapshot);
		if (restored.kind !== 'supported') {
			throw new Error(restored.reason);
		}
		expect(restored.snapshot.textSegments![0].style.underline).toBeTruthy();
		expect(inner.style.textDecoration).toBe('underline');
	});

	it.each([false, true])('removes and restores nested multi-run underline (whole=%s)', (whole) => {
		const source = element();
		source.textSegments![0].style.underline = true;
		const { seed, root } = mount(source);
		const outer = root.firstElementChild!.firstElementChild as HTMLElement;
		outer.style.textDecoration = 'underline';
		const original = outer.firstChild as Text;
		const remainder = original.splitText(2);
		for (const node of [original, remainder]) {
			const span = document.createElement('span');
			outer.insertBefore(span, node);
			span.append(node);
		}
		const before = readInlineListSnapshot(seed, root);
		if (before.kind !== 'supported') {
			throw new Error(before.reason);
		}
		const off = {
			...before.snapshot,
			textSegments: before.snapshot.textSegments!.map((segment, index) =>
				index === 0 || (whole && index === 1)
					? { ...segment, style: { ...segment.style, underline: false } }
					: segment,
			),
		};
		for (let attempt = 0; attempt < 2; attempt++) {
			const result = reconcileInlineListFormatting(seed, root, off);
			if (result.kind !== 'supported') {
				throw new Error(result.reason);
			}
			expect(outer.style.textDecoration).toBe('none');
			expect((outer.firstChild as HTMLElement).style.textDecoration).toBe('none');
			expect((outer.lastChild as HTMLElement).style.textDecoration).toBe(
				whole ? 'none' : 'underline',
			);
			expect(result.snapshot.textSegments![0].style.underline).toBeFalsy();
			expect(Boolean(result.snapshot.textSegments![1].style.underline)).toBe(!whole);
			expect(outer.firstChild!.firstChild).toBe(original);
			expect(outer.lastChild!.firstChild).toBe(remainder);
			const restored = reconcileInlineListFormatting(seed, root, before.snapshot);
			if (restored.kind !== 'supported') {
				throw new Error(restored.reason);
			}
			expect(
				restored.snapshot.textSegments!.slice(0, 2).every((run) => run.style.underline),
			).toBeTruthy();
		}
	});

	it('reconciles explicit formatting and model undo without replacing original body nodes', () => {
		const { seed, root } = mount();
		const originalNode = root.firstElementChild!.firstElementChild!.firstChild;
		const before = readInlineListSnapshot(seed, root);
		if (before.kind !== 'supported') {
			throw new Error(before.reason);
		}
		const changed = {
			...before.snapshot,
			textSegments: before.snapshot.textSegments!.map((segment) => ({
				...segment,
				style: { ...segment.style, bold: false, italic: true },
			})),
		};
		const applied = reconcileInlineListFormatting(seed, root, changed);
		if (applied.kind !== 'supported') {
			throw new Error(applied.reason);
		}
		expect(applied.snapshot.textSegments![0].style).toMatchObject({ bold: false, italic: true });
		expect(root.firstElementChild!.firstElementChild!.firstChild).toBe(originalNode);
		const undone = reconcileInlineListFormatting(seed, root, before.snapshot);
		if (undone.kind !== 'supported') {
			throw new Error(undone.reason);
		}
		expect(undone.snapshot.textSegments![0].style.bold).toBeTruthy();
		expect(undone.snapshot.text).toBe('First\nLast');
	});

	it('splits a formatted range while retaining the selected authored characters', () => {
		const { seed, root } = mount();
		document.body.append(root);
		const before = readInlineListSnapshot(seed, root);
		if (before.kind !== 'supported') {
			throw new Error(before.reason);
		}
		const range = document.createRange();
		range.setStart(root.firstElementChild!.firstElementChild!.firstChild!, 1);
		range.setEnd(root.firstElementChild!.firstElementChild!.firstChild!, 4);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
		const original = before.snapshot.textSegments![0];
		const changed = {
			...before.snapshot,
			textSegments: [
				{ ...original, text: 'F' },
				{ text: 'irs', style: { ...original.style, italic: true } },
				{ text: 't', style: original.style },
				...before.snapshot.textSegments!.slice(1),
			],
		};
		const applied = reconcileInlineListFormatting(seed, root, changed);
		if (applied.kind !== 'supported') {
			throw new Error(applied.reason);
		}
		expect(
			applied.snapshot.textSegments!.find((segment) => segment.text === 'irs')?.style.italic,
		).toBeTruthy();
		expect(selection.toString()).toBe('irs');
		expect(applied.snapshot.textSegments![0].paragraphProperties).toStrictEqual({
			paragraphSpacingAfter: 18,
		});
		root.remove();
		selection.removeAllRanges();
	});

	it('removes underline from a selected substring across metric children while preserving neighbours', () => {
		const source = element();
		source.textSegments![0].style.underline = true;
		source.textSegments![0].style.strikethrough = true;
		const { seed, root } = mount(source);
		document.body.append(root);
		const outer = root.firstElementChild!.firstElementChild as HTMLElement;
		outer.style.textDecoration = 'underline line-through';
		const first = outer.firstChild as Text;
		const last = first.splitText(2);
		for (const node of [first, last]) {
			const span = document.createElement('span');
			span.style.textDecoration = 'underline line-through';
			outer.insertBefore(span, node);
			span.append(node);
		}
		const before = readInlineListSnapshot(seed, root);
		if (before.kind !== 'supported') {
			throw new Error(before.reason);
		}
		const range = document.createRange();
		range.setStart(first, 1);
		range.setEnd(last, 2);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
		const original = before.snapshot.textSegments![0];
		const result = reconcileInlineListFormatting(seed, root, {
			...before.snapshot,
			textSegments: [
				{ ...original, text: 'F' },
				{ text: 'irs', style: { ...original.style, underline: false } },
				{ text: 't', style: original.style },
				...before.snapshot.textSegments!.slice(2),
			],
		});
		if (result.kind !== 'supported') {
			throw new Error(result.reason);
		}
		expect(selection.toString()).toBe('irs');
		expect(first.isConnected).toBeTruthy();
		expect(last.isConnected).toBeTruthy();
		expect(outer.style.textDecoration).toBe('none');
		const runs = result.snapshot.textSegments!.slice(0, 4);
		expect(runs.map((run) => [run.text, Boolean(run.style.underline)])).toStrictEqual([
			['F', true],
			['i', false],
			['rs', false],
			['t', true],
		]);
		expect(runs.every((run) => run.style.strikethrough)).toBeTruthy();
		expect(first.parentElement!.style.textDecoration).toBe('underline line-through');
		expect(last.parentElement!.style.textDecoration).toBe('line-through');
		expect(result.snapshot.textSegments![0].paragraphProperties).toStrictEqual({
			paragraphSpacingAfter: 18,
		});
		root.remove();
		selection.removeAllRanges();
	});

	it('refuses stale formatted text before mutating the current editor', () => {
		const { seed, root } = mount();
		const before = readInlineListSnapshot(seed, root);
		if (before.kind !== 'supported') {
			throw new Error(before.reason);
		}
		const html = root.innerHTML;
		expect(
			reconcileInlineListFormatting(seed, root, { ...before.snapshot, text: 'stale' }).kind,
		).toBe('unsupported');
		expect(root.innerHTML).toBe(html);
	});

	it('maps selected characters in an inserted native paragraph to current snapshot indices', () => {
		const { seed, root } = mount();
		document.body.append(root);
		const clone = root.firstElementChild!.cloneNode(true) as HTMLElement;
		clone.firstElementChild!.setAttribute('data-seg-idx', '0');
		clone.firstElementChild!.textContent = 'Inserted';
		root.insertBefore(clone, root.lastElementChild);
		const range = document.createRange();
		range.setStart(clone.firstElementChild!.firstChild!, 1);
		range.setEnd(clone.firstElementChild!.firstChild!, 4);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
		const read = readInlineListSelection(seed, root, selection);
		expect(read.kind).toBe('supported');
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.selection).toStrictEqual({
			startSegIdx: 2,
			startOffset: 1,
			endSegIdx: 2,
			endOffset: 4,
		});
		expect(read.bodyRange).toStrictEqual({ start: 7, end: 10 });
		root.remove();
		selection.removeAllRanges();
	});

	it('rejects a selection in another editor rather than falling back to all text', () => {
		const first = mount();
		const second = mount();
		document.body.append(first.root, second.root);
		const range = document.createRange();
		range.selectNodeContents(second.root);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
		expect(readInlineListSelection(first.seed, first.root, selection)).toMatchObject({
			kind: 'unsupported',
			reason: 'selection-outside-session',
		});
		first.root.remove();
		second.root.remove();
		selection.removeAllRanges();
	});

	it('keeps an original field identity when only its validated style token changes', () => {
		const source = element();
		source.textSegments![0].fieldType = 'slidenum';
		source.textSegments![0].fieldGuid = 'original-field';
		const { seed, root } = mount(source);
		const run = root.firstElementChild!.firstElementChild as HTMLElement;
		run.dataset.pptxListRun = registerInlineListRunStyle(seed, { italic: true })!;
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.textSegments![0].fieldGuid).toBe('original-field');
		expect(read.snapshot.textSegments![0].style.italic).toBeTruthy();
	});

	it.each(['character', 'numbered'] as const)(
		'round-trips a native %s list insertion with actual body style and original paragraph spacing',
		async (kind) => {
			const { handler, data, createSlide } = await PresentationBuilder.create();
			const slide = createSlide('Blank')
				.addText('First\nLast', { x: 40, y: 40, width: 400, height: 300 })
				.build();
			const shape = slide.elements[0];
			if (!hasTextProperties(shape)) {
				throw new Error('Expected text');
			}
			shape.textSegments = element().textSegments;
			shape.textSegments![0].paragraphProperties!.paragraphPropertiesExtLstXml = {
				'a:ext': { '@_uri': 'original-paragraph-only' },
			};
			if (kind === 'character') {
				for (const segment of shape.textSegments!) {
					if (segment.bulletInfo) {
						segment.bulletInfo = { char: '◆', color: '#CC6600', sizePercent: 75 };
					}
				}
			}
			data.slides.push(slide);
			const initial = await handler.save(data.slides);
			const asBuffer = (bytes: Uint8Array) =>
				bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
			const loadedHandler = new PptxHandler();
			const loaded = await loadedHandler.load(asBuffer(initial));
			const loadedShape = loaded.slides[0].elements[0];
			if (loadedShape.type !== 'text') {
				throw new Error('Expected text');
			}
			const { seed, root } = mount(loadedShape);
			const added = root.firstElementChild!.cloneNode(true) as HTMLElement;
			added.firstElementChild!.textContent = 'New body';
			root.insertBefore(added, root.lastElementChild);
			const read = readInlineListSnapshot(seed, root);
			if (read.kind !== 'supported') {
				throw new Error(read.reason);
			}
			const saved = await loadedHandler.save([
				{
					...loaded.slides[0],
					isDirty: true,
					elements: [
						{ ...loadedShape, text: read.snapshot.text, textSegments: read.snapshot.textSegments },
					],
				},
			]);
			const reloaded = await new PptxHandler().load(asBuffer(saved));
			const reopened = reloaded.slides[0].elements[0];
			if (!hasTextProperties(reopened)) {
				throw new Error('Expected text');
			}
			const inserted = reopened.textSegments!.find((segment) => segment.text === 'New body')!;
			expect(inserted.style).toMatchObject({ fontSize: 32, bold: true, color: '#CC00AA' });
			const xml = await (
				await JSZip.loadAsync(saved)
			)
				.file('ppt/slides/slide1.xml')!
				.async('string');
			const paragraphs = [...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/gu)].map((match) => match[0]);
			const insertedXml = paragraphs.find((paragraph) => paragraph.includes('New body'))!;
			expect(insertedXml).toContain('lvl="1"');
			expect(insertedXml).toContain('<a:spcAft>');
			expect(insertedXml).not.toContain('original-paragraph-only');
			const originalXml = await (
				await JSZip.loadAsync(initial)
			)
				.file('ppt/slides/slide1.xml')!
				.async('string');
			const originalLast = [...originalXml.matchAll(/<a:p>[\s\S]*?<\/a:p>/gu)].find((match) =>
				match[0].includes('Last'),
			)![0];
			const originalFirst = [...originalXml.matchAll(/<a:p>[\s\S]*?<\/a:p>/gu)].find((match) =>
				match[0].includes('First'),
			)![0];
			const savedFirst = paragraphs.find((paragraph) => paragraph.includes('First'))!;
			expect(savedFirst.match(/<a:pPr[\s\S]*?<\/a:pPr>/u)?.[0]).toStrictEqual(
				originalFirst.match(/<a:pPr[\s\S]*?<\/a:pPr>/u)?.[0],
			);
			expect(insertedXml.match(/<a:spcAft>[\s\S]*?<\/a:spcAft>/u)?.[0]).toStrictEqual(
				originalFirst.match(/<a:spcAft>[\s\S]*?<\/a:spcAft>/u)?.[0],
			);
			expect(
				paragraphs
					.find((paragraph) => paragraph.includes('Last'))!
					.match(/<a:pPr[\s\S]*?<\/a:pPr>/u)?.[0],
			).toStrictEqual(originalLast.match(/<a:pPr[\s\S]*?<\/a:pPr>/u)?.[0]);
		},
		30_000,
	);

	it('keeps soft breaks and repeated paragraph metadata through current-snapshot AutoCorrect', () => {
		const source = element([
			{
				text: 'same',
				style: { bold: true },
				bulletInfo: { char: '◆' },
				paragraphProperties: { paragraphSpacingAfter: 18 },
			},
			{
				text: '\n',
				style: { italic: true },
				isLineBreak: true,
				breakRunProperties: { '@_lang': 'fr' },
			},
			{ text: 'same', style: { italic: true } },
			{ text: '\n', style: {}, isParagraphBreak: true },
			{ text: 'same', style: {}, paragraphProperties: { paragraphSpacingAfter: 9 } },
		]);
		const { seed, root } = mount(source);
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		const corrected = reconcileInlineListSnapshot(read.snapshot, 'Same\nsame\nsame')!;
		expect(corrected.textSegments![1]).toStrictEqual(source.textSegments![1]);
		expect(corrected.textSegments![0].paragraphProperties).toStrictEqual({
			paragraphSpacingAfter: 18,
		});
		expect(corrected.textSegments!.at(-1)!.paragraphProperties).toStrictEqual({
			paragraphSpacingAfter: 9,
		});
	});

	it('changes current list formatting without replacing original paragraph provenance', () => {
		const { seed, root } = mount();
		const block = root.firstElementChild as HTMLElement;
		block.dataset.pptxListParagraph = registerInlineListParagraphFormat(seed, {
			bulletInfo: { none: true },
		})!;
		const off = readInlineListSnapshot(seed, root);
		if (off.kind !== 'supported') {
			throw new Error(off.reason);
		}
		expect(off.paragraphs[0].bulletMarker).toBeUndefined();
		expect(off.snapshot.textSegments![0].paragraphProperties).toStrictEqual({
			paragraphSpacingAfter: 18,
		});
		block.dataset.pptxListParagraph = registerInlineListParagraphFormat(seed, {
			bulletInfo: { char: '◆' },
			paragraphLevel: 2,
		})!;
		const on = readInlineListSnapshot(seed, root);
		if (on.kind !== 'supported') {
			throw new Error(on.reason);
		}
		expect(on.paragraphs[0].bulletMarker).toBe('◆');
		expect(on.snapshot.textSegments![0].paragraphLevel).toBe(2);
		expect(on.snapshot.textSegments![0].endParaRunProperties).toStrictEqual({ '@_lang': 'en-US' });
	});

	it('changes current run formatting independently of the original token', () => {
		const { seed, root } = mount();
		const run = root.firstElementChild!.firstElementChild as HTMLElement;
		run.dataset.pptxListRun = registerInlineListRunStyle(seed, { fontSize: 44, italic: true })!;
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.textSegments![0].style).toStrictEqual({ fontSize: 44, italic: true });
	});

	it('does not resurrect atomic data after deleting and retyping identical text', () => {
		const source = element();
		source.textSegments![0].fieldType = 'slidenum';
		source.textSegments![0].fieldGuid = 'original-field';
		const { seed, root } = mount(source);
		root.firstElementChild!.firstElementChild!.replaceChildren(document.createTextNode('First'));
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.textSegments![0].fieldGuid).toBeUndefined();
	});

	it('seeds empty body style independently of its custom marker and consumes its insertion hint', () => {
		const source = element([
			{
				text: '◆ ',
				style: { fontSize: 60, fontFamily: 'Symbol' },
				bulletInfo: { char: '◆' },
				paragraphInsertionStyle: { fontSize: 18, fontFamily: 'Arial' },
				paragraphProperties: { paragraphSpacingAfter: 9 },
			},
		]);
		const { seed, root } = mount(source);
		expect(seed.paragraphs[0].runs[0].style).toStrictEqual({ fontSize: 18, fontFamily: 'Arial' });
		const run = root.firstElementChild!.firstElementChild as HTMLElement;
		run.textContent = 'New body';
		let read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.textSegments![0].paragraphInsertionStyle).toBeUndefined();
		expect(read.snapshot.textSegments![0].style.fontSize).toBe(18);
		run.style.fontSize = '28px';
		read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.textSegments![0].paragraphInsertionStyle).toBeUndefined();
		expect(read.snapshot.textSegments![0].style.fontSize).toBe(28);
	});

	it('uses a runless content carrier insertion hint without changing its no-op metadata', () => {
		const source = element([
			{
				text: '',
				style: {},
				bulletInfo: { char: '◆' },
				paragraphInsertionStyle: { fontSize: 32, bold: true, italic: true, underline: true },
				endParaRunProperties: { '@_lang': 'en-US' },
			},
		]);
		const { seed, root } = mount(source);
		expect(seed.paragraphs[0].runs[0].style).toStrictEqual(
			source.textSegments![0].paragraphInsertionStyle,
		);
		const before = readInlineListSnapshot(seed, root);
		if (before.kind !== 'supported') {
			throw new Error(before.reason);
		}
		expect(before.snapshot.textSegments).toStrictEqual(source.textSegments);
		root.firstElementChild!.firstElementChild!.textContent = 'Typed';
		const after = readInlineListSnapshot(seed, root);
		if (after.kind !== 'supported') {
			throw new Error(after.reason);
		}
		expect(after.snapshot.textSegments![0].style).toStrictEqual(
			source.textSegments![0].paragraphInsertionStyle,
		);
		expect(after.snapshot.textSegments![0].paragraphInsertionStyle).toBeUndefined();
	});

	it.each([
		{ fieldType: 'slidenum', fieldGuid: 'field' },
		{ equationXml: { 'm:r': { 'm:t': 'x' } } },
		{ rubyText: 'reading' },
	])('does not replace empty atomic content with an insertion-style virtual run: %j', (atomic) => {
		const source = element([
			{
				text: '',
				style: { fontSize: 20 },
				bulletInfo: { char: '◆' },
				paragraphInsertionStyle: { fontSize: 32 },
				...atomic,
			},
		]);
		const seed = createInlineListSeed(source)!;
		expect(seed.paragraphs[0].runs[0].segmentIndex).toBe(0);
		expect(seed.paragraphs[0].runs[0].style).toStrictEqual({ fontSize: 20 });
	});

	it('does not accept another editing session tokens', () => {
		const first = mount();
		const second = mount();
		first.root.append(second.root.firstElementChild!.cloneNode(true));
		expect(readInlineListSnapshot(first.seed, first.root).kind).toBe('unsupported');
	});

	it('preserves an authored sole soft break instead of treating it as a caret placeholder', () => {
		const source = element([
			{ text: '\n', isLineBreak: true, style: { fontSize: 20 }, bulletInfo: { char: '◆' } },
		]);
		const { seed, root } = mount(source);
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.text).toBe('\n');
		expect(read.snapshot.textSegments).toStrictEqual(source.textSegments);
	});

	it('retains actual inline changes without flattening source native style metadata', () => {
		const source = element();
		source.textSegments![0].style.authoredRunStyle = { fontSize: 32, color: '#CC00AA' };
		source.textSegments![0].style.inheritedRunStyle = { fontSize: 20 };
		const { seed, root } = mount(source);
		const span = root.firstElementChild!.firstElementChild as HTMLElement;
		span.style.fontSize = '36px';
		span.style.fontWeight = '400';
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.textSegments![0].style).toMatchObject({
			fontSize: 36,
			bold: false,
			authoredRunStyle: source.textSegments![0].style.authoredRunStyle,
			inheritedRunStyle: { fontSize: 20 },
		});
	});

	it('does not grant a second original paragraph identity through binding', () => {
		const { seed, root } = mount();
		const clone = root.firstElementChild!.cloneNode(true);
		expect(bindInlineListParagraph(seed, clone, 0)).toBeFalsy();
		expect(bindInlineListRun(seed, clone.firstChild!, 0)).toBeFalsy();
	});

	it('does not opt plain text into a new editing surface', () => {
		expect(createInlineListSeed(element([{ text: 'Plain', style: {} }]))).toBeUndefined();
	});

	it('preserves exact authored segments on a no-op', () => {
		const { seed, root, source } = mount();
		const read = readInlineListSnapshot(seed, root);
		expect(read.kind).toBe('supported');
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.text).toBe('First\nLast');
		expect(read.snapshot.textSegments).toStrictEqual(source.textSegments);
	});

	it('continues a cloned native paragraph without copying its paragraph metadata', () => {
		const { seed, root } = mount();
		const added = root.firstElementChild!.cloneNode(true) as HTMLElement;
		added.firstElementChild!.textContent = 'Inserted';
		root.insertBefore(added, root.lastElementChild);
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.text).toBe('First\nInserted\nLast');
		const inserted = read.snapshot.textSegments!.find((run) => run.text === 'Inserted')!;
		expect(inserted.style).toMatchObject({ fontSize: 32, bold: true, color: '#CC00AA' });
		expect(inserted.paragraphLevel).toBe(1);
		expect(inserted.paragraphProperties).toStrictEqual({ paragraphSpacingAfter: 18 });
		expect(inserted.endParaRunProperties).toBeUndefined();
		expect(read.paragraphs.map((paragraph) => paragraph.bulletMarker)).toStrictEqual([
			'III.',
			'IV.',
			'V.',
		]);
		expect(
			read.snapshot.textSegments!.find((run) => run.text === 'Last')!.paragraphProperties,
		).toStrictEqual({ paragraphSpacingAfter: 7 });
	});

	it('never recognizes a copied field token as the original field', () => {
		const source = element();
		source.textSegments![0].fieldType = 'slidenum';
		source.textSegments![0].fieldGuid = 'source-field';
		const { seed, root } = mount(source);
		root.append(root.firstElementChild!.cloneNode(true));
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		const firsts = read.snapshot.textSegments!.filter((run) => run.text === 'First');
		expect(firsts[0].fieldGuid).toBe('source-field');
		expect(firsts[1].fieldGuid).toBeUndefined();
	});

	it('preserves intentional empty native paragraphs', () => {
		const { seed, root } = mount();
		const empty = root.firstElementChild!.cloneNode(true) as HTMLElement;
		empty.replaceChildren(document.createElement('br'));
		root.insertBefore(empty, root.lastElementChild);
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		expect(read.snapshot.text).toBe('First\n\nLast');
		expect(read.paragraphs).toHaveLength(3);
	});

	it('rejects unrecognized structure without returning stale text', () => {
		const { seed, root } = mount();
		root.innerHTML = '<table><tbody><tr><td>Current paste</td></tr></tbody></table>';
		expect(readInlineListSnapshot(seed, root)).toMatchObject({
			kind: 'unsupported',
			text: 'Current paste',
		});
	});

	it('reconciles AutoCorrect against the current snapshot and rejects new paragraph guesses', () => {
		const { seed, root } = mount();
		root.firstElementChild!.firstElementChild!.textContent = 'first';
		const read = readInlineListSnapshot(seed, root);
		if (read.kind !== 'supported') {
			throw new Error(read.reason);
		}
		const corrected = reconcileInlineListSnapshot(read.snapshot, 'First\nLast');
		expect(corrected?.textSegments?.[0].style.bold).toBeTruthy();
		expect(reconcileInlineListSnapshot(read.snapshot, 'First\nNew\nLast')).toBeUndefined();
	});
});
