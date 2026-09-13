// @vitest-environment happy-dom
/**
 * Mid-edit toolbar style race.
 *
 * `InlineTextEditor`'s contentEditable is UNCONTROLLED: the DOM owns the text
 * between keystrokes and blur/commit, and only pushes plain text out (into
 * `inlineEditingText`) on every input. The model's `selectedElement.textSegments`
 * is not refreshed from that live text until commit. Toolbar buttons use
 * `onMouseDown` + `preventDefault()` specifically so a click does not blur the
 * editor first, so a user CAN apply a style (Bold, Change Case, ...) while text
 * typed earlier in the same edit session has never been written back to the
 * model. Previously `updateSelectedTextStyle`/`updateSelectedTextCase` read
 * `selectedElement.textSegments` directly, so the style/case update applied to
 * stale pre-edit content and the freshly typed text was later overwritten again
 * by whatever the blur/commit path produced - the toolbar action was silently
 * lost. These tests drive the real `useElementOperations` hook and assert a
 * style/case change made while `inlineEditingElementId` is set reflects the
 * LIVE `inlineEditingText`, not the stale model segments.
 */
import type { PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { buildParagraphs, elementBulletKind, remapTextToSegments } from 'pptx-viewer-shared';
import type { InlineTextEditSnapshot } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { EditorHistoryResult } from './useEditorHistory';
import { useElementOperations } from './useElementOperations';
import type { ElementOperations } from './useElementOperations';

function textElement(): PptxElement {
	return {
		id: 'shape-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 50,
		text: 'Hello',
		textStyle: { fontSize: 18 },
		textSegments: [{ text: 'Hello', style: { fontSize: 18 } }],
	} as PptxElement;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

interface Harness {
	ops: () => ElementOperations;
	slides: () => PptxSlide[];
}

/**
 * Mount the real hook. `inlineEditingElementId`/`inlineEditingText` simulate an
 * in-progress edit session where the user has typed past what `textSegments`
 * on the model still reflects.
 */
function mount(
	inlineEditingElementId: string | null,
	inlineEditingText: string,
	initialElement = textElement(),
	snapshot?: InlineTextEditSnapshot,
): Harness {
	let slides: PptxSlide[] = [
		{ id: 'slide-1', rId: 'rId2', slideNumber: 1, elements: [initialElement] },
	];
	let latest: ElementOperations | undefined;

	function Probe(): null {
		latest = useElementOperations({
			slides,
			activeSlide: slides[0],
			activeSlideIndex: 0,
			selectedElement: slides[0].elements[0],
			selectedElementId: 'shape-1',
			editTemplateMode: false,
			templateElements: [],
			history: { markDirty: vi.fn() } as unknown as EditorHistoryResult,
			setSlides: (updater) => {
				slides = typeof updater === 'function' ? updater(slides) : updater;
				act(() => root.render(<Probe />));
			},
			setTemplateElementsBySlideId: vi.fn(),
			setSelectedElementId: vi.fn(),
			setSelectedElementIds: vi.fn(),
			setInlineEditingElementId: vi.fn(),
			setContextMenuState: vi.fn(),
			inlineEditingElementId,
			inlineEditingText,
			inlineEditingSnapshotRef: { current: snapshot },
		});
		return null;
	}

	act(() => root.render(<Probe />));
	return {
		ops: () => latest!,
		slides: () => slides,
	};
}

describe('updateSelectedTextStyle mid-edit race', () => {
	it('formats the live list runs rather than spreading the original run pattern', () => {
		const snapshot: InlineTextEditSnapshot = {
			elementId: 'shape-1',
			text: 'Hello\nNew',
			textSegments: [
				{ text: 'Hello', style: { fontSize: 18 }, bulletInfo: { char: '•' } },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{
					text: 'New',
					style: { fontSize: 32, color: '#cc00aa' },
					bulletInfo: { char: '•' },
					paragraphLevel: 1,
				},
			],
		};
		const harness = mount('shape-1', snapshot.text, textElement(), snapshot);
		act(() => harness.ops().updateSelectedTextStyle({ bold: true }));
		expect(harness.slides()[0].elements[0]).toMatchObject({
			textSegments: [
				expect.objectContaining({
					text: 'Hello',
					style: expect.objectContaining({ fontSize: 18, bold: true }),
				}),
				expect.objectContaining({ isParagraphBreak: true }),
				expect.objectContaining({
					text: 'New',
					paragraphLevel: 1,
					style: expect.objectContaining({ fontSize: 32, color: '#cc00aa', bold: true }),
				}),
			],
		});
	});

	it.each([false, true])(
		'honors explicit formatting before runless typing (with list=%s)',
		(withList) => {
			const initial = {
				...textElement(),
				text: '',
				textSegments: [
					{
						text: '',
						style: {},
						paragraphInsertionStyle: { bold: true, color: '#007000', fontSize: 40 },
					},
				],
			} as PptxElement;
			const harness = mount(null, '', initial);
			const updates = { bold: false, color: '#000000', fontSize: 24 };
			act(() =>
				harness.ops().updateSelectedTextStyle({
					...updates,
					...(withList ? { listType: 'numbered' as const } : {}),
				}),
			);
			const element = harness.slides()[0].elements[0] as PptxElement & {
				textSegments: TextSegment[];
			};
			const typed = remapTextToSegments('Typed', element.textSegments, {});
			expect(typed.at(-1)?.style).toMatchObject(updates);
			expect(typed.every((segment) => !segment.paragraphInsertionStyle)).toBeTruthy();
		},
	);

	it('authors real bullets and keeps a repeated explicit setter on', () => {
		const harness = mount(null, '');
		for (let call = 0; call < 2; call++) {
			act(() => harness.ops().updateSelectedTextStyle({ listType: 'bullet' }));
			const element = harness.slides()[0].elements[0];
			expect(elementBulletKind(element)).toBe('bullet');
			expect(buildParagraphs(element)[0].bulletMarker).toBe('•');
			expect(
				buildParagraphs(element)[0]
					.runs.map((run) => run.text)
					.join(''),
			).toBe('Hello');
		}
		act(() => harness.ops().updateSelectedTextStyle({ listType: 'none' }));
		expect(elementBulletKind(harness.slides()[0].elements[0])).toBe('none');
	});

	it('lists the current typed paragraphs and applies accompanying character formatting', () => {
		const harness = mount('shape-1', 'Hello there\nNext item');
		act(() => harness.ops().updateSelectedTextStyle({ listType: 'numbered', bold: true }));
		const element = harness.slides()[0].elements[0];
		const paragraphs = buildParagraphs(element);
		expect(paragraphs.map((paragraph) => paragraph.bulletMarker)).toStrictEqual(['1.', '2.']);
		expect(
			paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join('')),
		).toStrictEqual(['Hello there', 'Next item']);
		expect(
			paragraphs
				.flatMap((paragraph) => paragraph.runs)
				.every((run) => run.style.fontWeight === 'bold'),
		).toBeTruthy();
	});

	it('preserves an unchanged suffix when Bold reconciles a pending paragraph insertion', () => {
		const last = {
			text: 'Last',
			style: { color: '#006600' },
			paragraphProperties: { paragraphSpacingAfter: 10 },
		};
		const element = {
			...textElement(),
			text: 'First\nLast',
			textSegments: [
				{ text: 'First', style: {}, paragraphProperties: { paragraphSpacingAfter: 20 } },
				{ text: '\n', style: {}, isParagraphBreak: true },
				last,
			],
		} as PptxElement;
		const harness = mount('shape-1', 'First\nInserted\nLast', element);
		act(() => harness.ops().updateSelectedTextStyle({ bold: true }));
		expect(harness.slides()[0].elements[0]).toMatchObject({
			text: 'First\nInserted\nLast',
			textSegments: expect.arrayContaining([{ ...last, style: { ...last.style, bold: true } }]),
		});
	});

	it('applies to the live typed text, not the stale model segments, while inline-editing', () => {
		const harness = mount('shape-1', 'Hello there, world');
		act(() => {
			harness.ops().updateSelectedTextStyle({ bold: true });
		});

		const el = harness.slides()[0].elements[0] as PptxElement & {
			text?: string;
			textSegments?: Array<{ text: string; style: { bold?: boolean } }>;
		};
		// The written segments cover the LIVE text length, not the stale "Hello".
		const combined = el.textSegments?.map((s) => s.text).join('') ?? '';
		expect(combined).toBe('Hello there, world');
		expect(el.text).toBe('Hello there, world');
		expect(el.textSegments?.every((s) => s.style.bold === true)).toBeTruthy();
	});

	it('leaves the model untouched by inline-edit reconciliation when not the live-edited element', () => {
		const harness = mount(null, '');
		act(() => {
			harness.ops().updateSelectedTextStyle({ bold: true });
		});

		const el = harness.slides()[0].elements[0] as PptxElement & { text?: string };
		// Not mid-edit: the stale "text" field is untouched, only style/segments change.
		expect(el.text).toBe('Hello');
	});
});
