// @vitest-environment happy-dom
import type { BulletInfo, TextPptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { inlineListBodyText } from './inline-list-body';
import { attachInlineListController, getActiveInlineListSelection } from './inline-list-controller';
import { initializeInlineListDom } from './inline-list-dom';
import { inlineListPresentationCss } from './inline-list-presentation';
import {
	bindInlineListParagraph,
	bindInlineListRun,
	createInlineListSeed,
} from './inline-list-seed';

function mount(bulletInfo: BulletInfo = { autoNumType: 'romanUcPeriod', autoNumStartAt: 3 }) {
	const element: TextPptxElement = {
		id: 'target',
		type: 'text',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		textSegments: [
			{
				text: 'First',
				style: { fontSize: 20 },
				bulletInfo,
				paragraphProperties: { paragraphSpacingAfter: 18 },
			},
			{ text: '\n', style: {}, isParagraphBreak: true },
			{ text: 'Last', style: { fontSize: 20 }, bulletInfo: { ...bulletInfo, paragraphIndex: 1 } },
		],
	};
	const seed = createInlineListSeed(element)!;
	const root = document.createElement('div');
	for (const paragraph of seed.paragraphs) {
		const block = document.createElement('div');
		block.dataset.pptxListParagraph = paragraph.token;
		bindInlineListParagraph(seed, block, paragraph.sourceIndex);
		for (const run of paragraph.runs) {
			const span = document.createElement('span');
			span.dataset.pptxListRun = run.token;
			span.textContent = run.text;
			bindInlineListRun(seed, span, run.segmentIndex);
			block.append(span);
		}
		root.append(block);
	}
	document.body.append(root);
	return { root, seed };
}

const css = () =>
	document.head.querySelector('style[data-pptx-list-presentation]')?.textContent ?? '';
afterEach(() => {
	document.body.replaceChildren();
	document.head
		.querySelectorAll('style[data-pptx-list-presentation]')
		.forEach((node) => node.remove());
});

describe('native list presentation controller', () => {
	it('projects inherited decoration without authoring it and observes only successful explicit formatting', () => {
		const element: TextPptxElement = {
			id: 'decorated',
			type: 'text',
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			textStyle: { underline: true, strikethrough: true },
			textSegments: [
				{ text: 'Body', style: {}, bulletInfo: { char: '◆' } },
				{ text: 'No', style: { underline: false, strikethrough: false } },
			],
		};
		const seed = createInlineListSeed(element)!;
		const root = document.createElement('div');
		document.body.append(root);
		initializeInlineListDom(root, seed);
		const onFormat = vi.fn();
		const controller = attachInlineListController(root, seed, { onFormat });
		const spans = root.querySelectorAll<HTMLElement>('[data-pptx-list-run]');
		expect(spans[0].style.textDecoration).toContain('underline');
		expect(spans[1].style.textDecoration).not.toContain('underline');
		const initial = controller.read();
		if (initial.kind !== 'supported') {
			throw new Error(initial.reason);
		}
		expect(initial.snapshot.textSegments).toStrictEqual(element.textSegments);
		for (const underline of [false, true, false]) {
			const snapshot = {
				...initial.snapshot,
				textSegments: initial.snapshot.textSegments!.map((segment) => ({
					...segment,
					style: { ...segment.style, underline, strikethrough: false },
				})),
			};
			expect(controller.format(snapshot).kind).toBe('supported');
			expect(spans[0].style.textDecoration.includes('underline')).toBe(underline);
		}
		expect(onFormat).toHaveBeenCalledTimes(3);
		root.dispatchEvent(new CompositionEvent('compositionstart'));
		expect(controller.format(initial.snapshot).kind).toBe('unsupported');
		expect(onFormat).toHaveBeenCalledTimes(3);
		controller.dispose();
	});

	it('projects only dedicated leading markers away, retaining literal numbers and soft breaks', () => {
		expect(
			inlineListBodyText([
				{ text: '1. ', style: {}, bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 } },
				{ text: '1. literal body', style: {} },
				{ text: '\n', style: {}, isLineBreak: true },
				{ text: '◆ ', style: {}, bulletInfo: { char: '◆' } },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: '◆ ', style: {}, bulletInfo: { char: '◆' } },
				{ text: '', style: {} },
			]),
		).toBe('1. literal body\n◆ \n');
		expect(inlineListBodyText(undefined)).toBe('');
	});

	it('delegates current selection and reports composition as unsupported, not plain text', () => {
		const { root, seed } = mount();
		const controller = attachInlineListController(root, seed);
		const selection = window.getSelection()!;
		selection.setBaseAndExtent(
			root.firstElementChild!.firstElementChild!.firstChild!,
			1,
			root.firstElementChild!.firstElementChild!.firstChild!,
			3,
		);
		expect(getActiveInlineListSelection(selection)).toMatchObject({
			kind: 'supported',
			bodyRange: { start: 1, end: 3 },
		});
		root.dispatchEvent(new Event('compositionstart'));
		expect(getActiveInlineListSelection(selection)).toStrictEqual({
			kind: 'unsupported',
			reason: 'composition-active',
		});
		controller.dispose();
		expect(getActiveInlineListSelection(selection)).toBeUndefined();
	});

	it('seeds styled native paragraphs exactly once without copying marker body style', () => {
		const element: TextPptxElement = {
			id: 'empty',
			type: 'text',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			textSegments: [
				{
					text: '◆ ',
					style: { fontSize: 60, fontFamily: 'Symbol' },
					bulletInfo: { char: '◆' },
					paragraphInsertionStyle: { fontSize: 18, bold: true, color: '#00AA00' },
				},
			],
		};
		const seed = createInlineListSeed(element)!;
		const root = document.createElement('div');
		expect(initializeInlineListDom(root, seed)).toBeTruthy();
		const run = root.querySelector<HTMLElement>('[data-pptx-list-run]')!;
		expect(run.style.fontSize).toBe('18px');
		expect(run.style.fontWeight).toBe('bold');
		expect(run.querySelector('br')).not.toBeNull();
		const original = root.firstChild;
		expect(initializeInlineListDom(root, seed)).toBeFalsy();
		expect(root.firstChild).toBe(original);
	});

	it('shows a new empty list item without inserting a marker or caret sentinel', () => {
		const { root, seed } = mount();
		const controller = attachInlineListController(root, seed);
		const inserted = root.firstElementChild!.cloneNode(true) as HTMLElement;
		inserted.firstElementChild!.replaceChildren(document.createElement('br'));
		root.insertBefore(inserted, root.lastElementChild);
		const before = root.innerHTML;
		const read = controller.refresh();
		expect(read).toMatchObject({ kind: 'supported', snapshot: { text: 'First\n\nLast' } });
		expect(css()).toContain('IV.');
		expect(css()).toContain('V.');
		expect(root.innerHTML).toBe(before);
		controller.dispose();
	});

	it('keeps separate editor styles independently scoped', () => {
		const one = mount();
		const two = mount({ char: '◆' });
		const first = attachInlineListController(one.root, one.seed);
		const second = attachInlineListController(two.root, two.seed);
		expect(one.root.dataset.pptxListSession).not.toBe(two.root.dataset.pptxListSession);
		expect(document.head.querySelectorAll('style[data-pptx-list-presentation]')).toHaveLength(2);
		first.dispose();
		expect(css()).toContain('◆');
		second.dispose();
	});

	it('uses resolved picture size and hanging paragraph geometry', () => {
		const rules = inlineListPresentationCss(
			document,
			'test',
			[
				{
					runs: [],
					segmentIndices: [],
					bulletStyle: {},
					marginLeftPx: 24,
					textIndentPx: -12,
					bulletPicture: {
						src: 'data:image/png;base64,AAAA',
						sizePx: 18,
						fallbackMarker: '•',
						accessibleLabel: 'Bullet',
					},
				},
			],
			[],
		);
		expect(rules).toContain('width: 18px !important');
		expect(rules).toContain('background-image: url(');
		expect(rules).toContain('margin: 0px 0px 0px 24px !important');
		expect(rules).toContain('text-indent: -12px !important');
		expect(rules).toContain('> :is(div,p):nth-child(1)::before');
	});

	it('escapes custom marker CSS and preserves resolved fallback markers', () => {
		const rules = inlineListPresentationCss(
			document,
			'test',
			[
				{
					runs: [],
					segmentIndices: [],
					bulletMarker: '"}; body { color:red }\\\n',
					bulletStyle: { fontFamily: 'Symbol' },
				},
			],
			[],
		);
		expect(rules).toContain('\\22 ');
		expect(rules).not.toContain('content: ""}');
		expect(rules).toContain('font-family: Symbol !important');
	});

	it('projects current numbering without changing editable descendants', () => {
		const { root, seed } = mount();
		const before = root.innerHTML;
		const onRead = vi.fn();
		const controller = attachInlineListController(root, seed, { onRead });
		expect(css()).toContain('III.');
		expect(css()).toContain('IV.');
		expect(root.innerHTML).toBe(before);
		const inserted = root.firstElementChild!.cloneNode(true) as HTMLElement;
		inserted.firstElementChild!.textContent = 'New';
		root.insertBefore(inserted, root.lastElementChild);
		const edited = root.innerHTML;
		root.dispatchEvent(new Event('input'));
		expect(css()).toContain('V.');
		expect(root.innerHTML).toBe(edited);
		expect(onRead.mock.lastCall![0].snapshot.text).toBe('First\nNew\nLast');
		controller.dispose();
	});

	it('pauses composition and never returns a stale snapshot', () => {
		const { root, seed } = mount();
		const controller = attachInlineListController(root, seed);
		const before = css();
		root.dispatchEvent(new Event('compositionstart'));
		root.firstElementChild!.firstElementChild!.textContent = 'Composing';
		root.dispatchEvent(new Event('input'));
		expect(css()).toBe(before);
		expect(controller.read()).toMatchObject({
			kind: 'unsupported',
			reason: 'composition-active',
			text: 'Composing\nLast',
		});
		root.dispatchEvent(new Event('compositionend'));
		expect(controller.read()).toMatchObject({
			kind: 'supported',
			snapshot: { text: 'Composing\nLast' },
		});
		controller.dispose();
	});

	it('clears stale presentation on unsupported topology', () => {
		const { root, seed } = mount();
		const controller = attachInlineListController(root, seed);
		root.append(document.createTextNode('outside'));
		expect(controller.refresh().kind).toBe('unsupported');
		expect(css()).not.toContain('III.');
		controller.dispose();
	});

	it('isolates replacement sessions and cleans up listeners and scope', () => {
		const { root, seed } = mount();
		root.setAttribute('data-pptx-list-session', 'previous');
		const first = attachInlineListController(root, seed);
		const onRead = vi.fn();
		const second = attachInlineListController(root, seed, { onRead });
		const current = root.getAttribute('data-pptx-list-session');
		first.dispose();
		expect(root.getAttribute('data-pptx-list-session')).toBe(current);
		expect(first.read().kind).toBe('unsupported');
		second.dispose();
		expect(root.getAttribute('data-pptx-list-session')).toBe('previous');
		expect(css()).toBe('');
		const count = onRead.mock.calls.length;
		root.dispatchEvent(new Event('input'));
		expect(onRead).toHaveBeenCalledTimes(count);
	});

	it('rejects a stale seed identity through the adapter guard', () => {
		const { root, seed } = mount();
		let current = true;
		const controller = attachInlineListController(root, seed, { isCurrent: () => current });
		current = false;
		expect(controller.refresh()).toMatchObject({ kind: 'unsupported', reason: 'inactive-session' });
		expect(css()).not.toContain('III.');
		controller.dispose();
	});
});
