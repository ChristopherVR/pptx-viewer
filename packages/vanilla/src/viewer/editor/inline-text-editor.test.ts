// @vitest-environment jsdom
/**
 * Regression: opening the inline editor must place the caret at the END of the
 * seeded text (typing appends), the contract shared by all five bindings via
 * `placeCaretAtEnd`. Focus alone leaves the caret at the start, which is the
 * parity bug this pins.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { openInlineEditor, readEditableText } from './inline-text-editor';
import { markInsertedParagraph } from './inline-text-paragraph-marker';

function textElement(): PptxElement {
	return {
		id: 'el-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 50,
		text: 'TARGET',
		textSegments: [{ text: 'TARGET', style: {} }],
	} as unknown as PptxElement;
}

describe('openInlineEditor caret placement', () => {
	it.each([
		{
			html: '<div data-pptx-text-flow id="boundary"><span data-pptx-bullet-marker>1.</span><span data-seg-idx="0"><br></span></div><div data-pptx-text-flow><span data-seg-idx="0" id="caret">TARGET</span></div>',
			text: '\nTARGET',
		},
		{
			html: '<div data-pptx-text-flow>TARGET</div><div data-pptx-text-flow data-pptx-paragraph-start><span data-seg-idx="0">SECOND</span><span data-seg-idx="0" id="boundary"><span id="caret"><br></span></span></div>',
			text: 'TARGET\nSECOND\n',
		},
	])('preserves an intentional empty paragraph: $text', ({ html, text }) => {
		const surface = document.createElement('div');
		surface.innerHTML = html;
		document.body.append(surface);
		const range = document.createRange();
		range.setStart(surface.querySelector('#caret')!, 0);
		range.collapse(true);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
		markInsertedParagraph(document, surface);
		expect(
			surface.querySelector('#boundary')!.hasAttribute('data-pptx-paragraph-start'),
		).toBeTruthy();
		expect(readEditableText(surface)).toBe(text);
		surface.remove();
	});

	it('marks a native split text-flow block without leaving a run annotation after undo', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		const onInput = vi.fn();
		const onCommit = vi.fn();
		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: textElement(),
			onInput,
			onCommit,
			onClose: () => {},
		});
		// Recorded Chromium structure after splitting a rich text-flow wrapper.
		const secondFlow = document.createElement('div');
		secondFlow.dataset.pptxTextFlow = '';
		const marker = document.createElement('span');
		marker.dataset.pptxBulletMarker = '';
		marker.textContent = '1. ';
		secondFlow.append(marker);
		const inserted = document.createElement('span');
		inserted.dataset.segIdx = '1';
		inserted.textContent = '\n';
		const suffix = document.createElement('span');
		suffix.textContent = 'NEXT';
		secondFlow.append(inserted, suffix);
		session.el.append(secondFlow);
		const range = document.createRange();
		range.setStart(inserted.firstChild!, 0);
		range.collapse(true);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
		session.el.dispatchEvent(
			new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' }),
		);
		expect(secondFlow.hasAttribute('data-pptx-paragraph-start')).toBeTruthy();
		expect(inserted.hasAttribute('data-pptx-paragraph-start')).toBeFalsy();
		inserted.textContent = 'INSERTED\n';
		session.el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
		expect(onInput).toHaveBeenLastCalledWith('TARGET\nINSERTED\nNEXT');
		// Native history restores the delimiter, then rejoins the original runs.
		inserted.textContent = '\n';
		session.el.dispatchEvent(new InputEvent('input', { inputType: 'historyUndo' }));
		expect(onInput).toHaveBeenLastCalledWith('TARGET\n\nNEXT');
		const originalFlow = session.el.querySelector<HTMLElement>('[data-pptx-text-flow]')!;
		originalFlow.append(inserted, suffix);
		secondFlow.remove();
		session.el.dispatchEvent(new InputEvent('input', { inputType: 'historyUndo' }));
		expect(onInput).toHaveBeenLastCalledWith('TARGET\nNEXT');
		secondFlow.append(inserted, suffix);
		session.el.append(secondFlow);
		session.el.dispatchEvent(new InputEvent('input', { inputType: 'historyRedo' }));
		expect(onInput).toHaveBeenLastCalledWith('TARGET\n\nNEXT');
		inserted.textContent = 'INSERTED\n';
		session.el.dispatchEvent(new InputEvent('input', { inputType: 'historyRedo' }));
		expect(onInput).toHaveBeenLastCalledWith('TARGET\nINSERTED\nNEXT');
		session.commit();
		expect(onCommit).toHaveBeenCalledExactlyOnceWith('TARGET\nINSERTED\nNEXT');
		overlayRoot.remove();
	});

	it('collapses the selection to the end of the seeded text', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);

		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: textElement(),
			onCommit: () => {},
			onClose: () => {},
		});

		const sel = window.getSelection();
		expect(sel).not.toBeNull();
		expect(sel!.rangeCount).toBe(1);
		const range = sel!.getRangeAt(0);
		expect(range.collapsed).toBeTruthy();
		const beforeCaret = document.createRange();
		beforeCaret.selectNodeContents(session.el);
		beforeCaret.setEnd(range.endContainer, range.endOffset);
		expect(beforeCaret.toString()).toBe('TARGET');

		session.cancel();
		overlayRoot.remove();
	});

	it.each([
		{
			name: 'ordinary adjacent run',
			text: 'First item',
			segments: [
				{ text: 'First', style: {} },
				{ text: ' ', style: {} },
				{ text: 'item', style: {} },
			],
			startChild: 1,
			startOffset: 1,
			endChild: 2,
			endOffset: 4,
			expectedIndex: 2,
		},
		{
			name: 'paragraph separator',
			text: 'AB',
			segments: [
				{ text: 'A', style: {} },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: 'B', style: {} },
			],
			startChild: 0,
			startOffset: 1,
			endChild: 2,
			endOffset: 1,
			expectedIndex: 2,
		},
		{
			name: 'display-only bullet marker',
			text: 'Item',
			segments: [
				{ text: '• ', style: {}, bulletInfo: { char: '•' } },
				{ text: 'Item', style: {} },
			],
			startChild: 0,
			startOffset: 2,
			endChild: 1,
			endOffset: 4,
			expectedIndex: 1,
		},
	] as const)(
		'reports only selected text after a $name boundary',
		({ text, segments, startChild, startOffset, endChild, endOffset, expectedIndex }) => {
			const overlayRoot = document.createElement('div');
			document.body.appendChild(overlayRoot);
			const onSelectionChange = vi.fn();
			const session = openInlineEditor({
				doc: document,
				overlayRoot,
				box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
				scale: 1,
				element: {
					...textElement(),
					text,
					textSegments: [...segments],
				} as PptxElement,
				onCommit: () => {},
				onSelectionChange,
				onClose: () => {},
			});
			const segmentSpans = session.el.querySelectorAll('[data-seg-idx]');
			const range = document.createRange();
			range.setStart(segmentSpans[startChild].firstChild!, startOffset);
			range.setEnd(segmentSpans[endChild].firstChild!, endOffset);
			const selection = window.getSelection()!;
			selection.removeAllRanges();
			selection.addRange(range);
			session.el.dispatchEvent(new PointerEvent('pointerup'));

			expect(onSelectionChange).toHaveBeenCalledWith({
				startSegIdx: expectedIndex,
				startOffset: 0,
				endSegIdx: expectedIndex,
				endOffset,
			});

			session.cancel();
			overlayRoot.remove();
		},
	);

	it('keeps adjacent rich-text runs in one flex item', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: {
				...textElement(),
				text: 'Alpha Beta',
				textSegments: [
					{ text: 'Alpha ', style: { bold: true } },
					{ text: 'Beta', style: { italic: true } },
				],
			} as PptxElement,
			onCommit: () => {},
			onClose: () => {},
		});

		expect(session.el.style.flexDirection).toBe('column');
		expect(session.el.children).toHaveLength(1);
		const flow = session.el.querySelector('[data-pptx-text-flow]');
		expect(flow?.parentElement).toBe(session.el);
		expect(flow?.tagName).toBe('DIV');
		expect(
			Array.from(flow?.querySelectorAll('[data-seg-idx]') ?? []).map((span) => span.textContent),
		).toStrictEqual(['Alpha ', 'Beta']);
		expect(readEditableText(session.el)).toBe('Alpha Beta');

		session.cancel();
		overlayRoot.remove();
	});
});

describe('openInlineEditor input handling', () => {
	it('marks generated list markers as display-only editor content', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		const onCommit = vi.fn();
		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: {
				...textElement(),
				text: 'Item',
				textSegments: [
					{
						text: '1. ',
						style: {},
						bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
					},
					{ text: 'Item', style: {} },
				],
			} as PptxElement,
			onCommit,
			onClose: () => {},
		});

		const marker = session.el.querySelector<HTMLElement>('[data-seg-idx="0"]');
		expect(marker?.hasAttribute('data-pptx-bullet-marker')).toBeTruthy();
		expect(marker?.contentEditable).toBe('false');
		expect(readEditableText(session.el)).toBe('Item');

		session.commit();
		expect(onCommit).not.toHaveBeenCalled();
		overlayRoot.remove();
	});

	it('gives a final empty list run a caret placeholder without committing it', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		const onCommit = vi.fn();
		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: {
				...textElement(),
				text: '1. ',
				textSegments: [
					{
						text: '1. ',
						style: {},
						bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
					},
					{ text: '', style: {} },
				],
			} as PptxElement,
			onCommit,
			onClose: () => {},
		});

		expect(session.el.querySelector('[data-pptx-empty-run]')?.firstElementChild?.tagName).toBe(
			'BR',
		);
		expect(readEditableText(session.el)).toBe('');
		session.commit();
		expect(onCommit).not.toHaveBeenCalled();

		overlayRoot.remove();
	});

	it('does not add a caret placeholder to an ordinary empty formatting run', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: {
				...textElement(),
				textSegments: [
					{ text: 'Hello', style: {} },
					{ text: '', style: { bold: true } },
					{ text: ' world', style: {} },
				],
			} as PptxElement,
			onCommit: () => {},
			onClose: () => {},
		});

		expect(session.el.querySelector('[data-pptx-empty-run]')).toBeNull();

		session.cancel();
		overlayRoot.remove();
	});

	it('marks the rich run or paragraph block that Chromium creates for plain Enter', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		const onInput = vi.fn();
		const onCommit = vi.fn();
		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: textElement(),
			onInput,
			onCommit,
			onClose: () => {},
		});

		const inserted = document.createElement('span');
		inserted.dataset.segIdx = '0';
		inserted.appendChild(document.createElement('br'));
		const textFlow = session.el.querySelector<HTMLElement>('[data-pptx-text-flow]')!;
		textFlow.appendChild(inserted);
		const range = document.createRange();
		range.setStart(inserted, 0);
		range.collapse(true);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);

		session.el.dispatchEvent(
			new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' }),
		);

		expect(inserted.hasAttribute('data-pptx-paragraph-start')).toBeTruthy();
		expect(readEditableText(session.el)).toBe('TARGET\n');
		expect(onInput).toHaveBeenLastCalledWith('TARGET\n');
		inserted.textContent = 'NEXT';
		expect(readEditableText(session.el)).toBe('TARGET\nNEXT');

		const insertedBlock = document.createElement('div');
		const nestedRun = document.createElement('span');
		nestedRun.dataset.segIdx = '0';
		nestedRun.appendChild(document.createElement('br'));
		insertedBlock.appendChild(nestedRun);
		textFlow.appendChild(insertedBlock);
		range.setStart(nestedRun, 0);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
		session.el.dispatchEvent(
			new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' }),
		);

		expect(insertedBlock.hasAttribute('data-pptx-paragraph-start')).toBeTruthy();
		expect(nestedRun.hasAttribute('data-pptx-paragraph-start')).toBeFalsy();
		expect(readEditableText(session.el)).toBe('TARGET\nNEXT\n');
		expect(onInput).toHaveBeenLastCalledWith('TARGET\nNEXT\n');
		session.commit();
		expect(onCommit).toHaveBeenCalledWith('TARGET\nNEXT\n');

		overlayRoot.remove();
	});

	it('marks the leading placeholder when plain Enter splits the start of a rich run', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		const onInput = vi.fn();
		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: textElement(),
			onInput,
			onCommit: () => {},
			onClose: () => {},
		});

		const originalRun = session.el.querySelector<HTMLElement>('[data-seg-idx="0"]')!;
		const textFlow = originalRun.parentElement!;
		const leading = document.createElement('span');
		leading.dataset.segIdx = '0';
		leading.appendChild(document.createElement('br'));
		textFlow.insertBefore(leading, originalRun);
		const range = document.createRange();
		range.setStart(originalRun.firstChild!, 0);
		range.collapse(true);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);

		session.el.dispatchEvent(
			new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' }),
		);

		expect(leading.hasAttribute('data-pptx-paragraph-start')).toBeTruthy();
		expect(originalRun.hasAttribute('data-pptx-paragraph-start')).toBeFalsy();
		expect(readEditableText(session.el)).toBe('\nTARGET');
		expect(onInput).toHaveBeenLastCalledWith('\nTARGET');

		session.cancel();
		overlayRoot.remove();
	});

	it('ignores a display-only marker when locating a leading list placeholder', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: textElement(),
			onCommit: () => {},
			onClose: () => {},
		});

		const originalRun = session.el.querySelector<HTMLElement>('[data-seg-idx="0"]')!;
		const textFlow = originalRun.parentElement!;
		originalRun.dataset.segIdx = '1';
		const originalBlock = document.createElement('div');
		textFlow.insertBefore(originalBlock, originalRun);
		originalBlock.appendChild(originalRun);
		const leadingBlock = document.createElement('div');
		const marker = document.createElement('span');
		marker.dataset.segIdx = '0';
		marker.dataset.pptxBulletMarker = '';
		marker.textContent = '• ';
		const leadingRun = document.createElement('span');
		leadingRun.dataset.segIdx = '1';
		leadingRun.appendChild(document.createElement('br'));
		leadingBlock.append(marker, leadingRun);
		textFlow.insertBefore(leadingBlock, originalBlock);
		const range = document.createRange();
		range.setStart(originalRun.firstChild!, 0);
		range.collapse(true);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);

		session.el.dispatchEvent(
			new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' }),
		);

		expect(leadingBlock.hasAttribute('data-pptx-paragraph-start')).toBeTruthy();
		expect(originalBlock.hasAttribute('data-pptx-paragraph-start')).toBeFalsy();
		expect(readEditableText(session.el)).toBe('\nTARGET');

		session.cancel();
		overlayRoot.remove();
	});
});

describe('openInlineEditor commit ordering', () => {
	it('fires onCommit while the surface is still attached and [data-inline-editor]-tagged', () => {
		// `a:spAutoFit` needs to measure the live editor node from inside
		// `onCommit` (see `resolveInlineTextAutoFitHeight`'s doc comment); a
		// node already `.remove()`d reports `offsetWidth: 0`, breaking that
		// measurement. This pins the ordering that makes it work: commit
		// before removal.
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		let attachedDuringCommit: boolean | undefined;
		let foundDuringCommit: Element | null | undefined;

		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: textElement(),
			onCommit: () => {
				attachedDuringCommit = document.body.contains(session.el);
				foundDuringCommit = document.querySelector('[data-inline-editor]');
			},
			onClose: () => {},
		});

		session.el.textContent = 'CHANGED';
		session.commit();

		expect(attachedDuringCommit).toBeTruthy();
		expect(foundDuringCommit).toBe(session.el);
		// ...and is removed once the commit callback returns.
		expect(document.body.contains(session.el)).toBeFalsy();

		overlayRoot.remove();
	});
});
