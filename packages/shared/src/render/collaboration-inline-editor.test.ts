// @vitest-environment happy-dom
import type { TextPptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { attachCollaborationInlineEditor } from './collaboration-inline-editor';
import { createCollaborationLivePatcher, findElementYMap } from './collaboration-live-patch';
import { reconcileSlidesInYDoc } from './collaboration-reconcile';
import type { YjsFactories } from './collaboration-sync';
import { readSlidesFromYDoc } from './collaboration-sync';
import { createSnapshotTextPositions } from './collaboration-text-snapshot-positions';

const cleanup: Array<() => void> = [];
afterEach(() => {
	cleanup
		.splice(0)
		.reverse()
		.forEach((dispose) => dispose());
	document.body.replaceChildren();
});
const element: TextPptxElement = {
	id: 'e1',
	type: 'text',
	x: 0,
	y: 0,
	width: 300,
	height: 100,
	text: 'Hello',
	textSegments: [{ text: 'Hello', style: {} }],
};
function factories(doc: Y.Doc): YjsFactories {
	return {
		createMap: () => new Y.Map(),
		createArray: () => new Y.Array(),
		createText: () => new Y.Text(),
		createTextPositions: (text) =>
			createSnapshotTextPositions(text as unknown as Y.Text, {
				read: () => Y.snapshot(doc),
				equal: Y.equalSnapshots,
				subscribeBeforeObservers: (listener) => {
					doc.on('beforeObserverCalls', listener);
					return () => doc.off('beforeObserverCalls', listener);
				},
			}),
	};
}
function peers(body = element.text ?? '') {
	const docs = [new Y.Doc(), new Y.Doc()];
	const source = { ...element, text: body, textSegments: [{ text: body, style: {} }] };
	reconcileSlidesInYDoc(
		[{ id: 's1', slideNumber: 1, elements: [structuredClone(source)] }],
		docs[0],
		factories(docs[0]),
	);
	Y.applyUpdate(docs[1], Y.encodeStateAsUpdate(docs[0]));
	const editors = docs.map((doc) => {
		const root = document.createElement('div');
		root.contentEditable = 'true';
		document.body.append(root);
		const patcher = createCollaborationLivePatcher();
		patcher.configure(doc, factories(doc), true);
		const onSnapshot = vi.fn();
		const onCancel = vi.fn();
		const controller = attachCollaborationInlineEditor(root, structuredClone(source), {
			patcher,
			slideId: 's1',
			onSnapshot,
			onCancel,
		});
		if (!controller) {
			throw new Error('Expected connected native editor');
		}
		cleanup.push(() => {
			controller.dispose();
			patcher.dispose();
			doc.destroy();
		});
		return { root, patcher, controller, onSnapshot, onCancel };
	});
	for (const [index, doc] of docs.entries()) {
		const other = docs[1 - index];
		const update = (bytes: Uint8Array, origin: unknown) => {
			if (origin !== other) {
				Y.applyUpdate(other, bytes, doc);
			}
		};
		doc.on('update', update);
		cleanup.push(() => doc.off('update', update));
	}
	return { docs, editors };
}
function begin(root: HTMLElement, from: number, to = from): Text {
	const text = root.querySelector('span')!.firstChild as Text;
	const range = document.createRange();
	range.setStart(text, from);
	range.setEnd(text, to);
	window.getSelection()!.removeAllRanges();
	window.getSelection()!.addRange(range);
	const before = new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText' });
	Object.defineProperty(before, 'getTargetRanges', { value: () => [range.cloneRange()] });
	root.dispatchEvent(before);
	return text;
}
function finish(root: HTMLElement, node: Text, from: number, inserted: string, to = from): void {
	node.data = node.data.slice(0, from) + inserted + node.data.slice(to);
	window
		.getSelection()!
		.setBaseAndExtent(node, from + inserted.length, node, from + inserted.length);
	root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
}
function type(root: HTMLElement, from: number, inserted: string): void {
	finish(root, begin(root, from), from, inserted);
}

describe('connected native inline editor', () => {
	it.each([
		['aaaa', 2, 'deleteContentBackward', 1, 2, 'aaa'],
		['aaaa', 2, 'deleteContentForward', 2, 3, 'aaa'],
		['A😀B', 3, 'deleteContentBackward', 1, 3, 'AB'],
		['A😀B', 1, 'deleteContentForward', 1, 3, 'AB'],
		['word word', 9, 'deleteWordBackward', 5, 9, 'word '],
		['word word', 0, 'deleteWordForward', 0, 5, 'word'],
		['e\u0301x', 2, 'deleteContentBackward', 0, 2, 'x'],
	] as const)(
		'captures %s at %s with %s when native target ranges are unavailable',
		(body, caret, inputType, from, to, expected) => {
			const { docs, editors } = peers(body);
			const root = editors[1].root;
			const node = root.querySelector('span')!.firstChild as Text;
			window.getSelection()!.setBaseAndExtent(node, caret, node, caret);
			const before = new InputEvent('beforeinput', { bubbles: true, inputType });
			Object.defineProperty(before, 'getTargetRanges', { value: () => [] });
			root.dispatchEvent(before);
			type(editors[0].root, 0, 'R');
			node.data = body.slice(0, from) + body.slice(to);
			root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
			for (const doc of docs) {
				expect(readSlidesFromYDoc(doc)[0].elements[0]).toMatchObject({ text: `R${expected}` });
			}
			expect(editors[1].onCancel).not.toHaveBeenCalled();
		},
	);

	it('tracks an explicit space trim before the following native Enter', () => {
		const { editors } = peers();
		type(editors[0].root, 5, ' ');
		const text = editors[0].root.querySelector('span')!.firstChild!;
		const range = document.createRange();
		range.setStart(text, 5);
		range.setEnd(text, 6);
		expect(editors[0].controller.mutate(range, () => range.deleteContents())).toBeTruthy();
		for (const editor of editors) {
			expect(editor.root.textContent).toBe('Hello');
		}
	});

	it('restores the caret through a remote insertion before its observed character', () => {
		const { docs, editors } = peers();
		const text = editors[1].root.querySelector('span')!.firstChild!;
		window.getSelection()!.setBaseAndExtent(text, 2, text, 2);
		const live = findElementYMap(docs[0], 's1', 'e1')!.get('textBody') as Y.Text;
		docs[0].transact(() => live.insert(0, 'A', {}), 'peer');
		expect(editors[1].root.textContent).toBe('AHello');
		expect(editors[1].controller.readSelection()).toMatchObject({
			bodyRange: { start: 3, end: 3 },
		});
	});

	it('preserves a backward selection through a remote repaint', () => {
		const { docs, editors } = peers();
		const text = editors[1].root.querySelector('span')!.firstChild!;
		const selection = window.getSelection()!;
		selection.setBaseAndExtent(text, 4, text, 1);
		const live = findElementYMap(docs[0], 's1', 'e1')!.get('textBody') as Y.Text;
		docs[0].transact(() => live.insert(0, 'A', {}), 'peer');
		expect(selection.anchorOffset).toBe(5);
		expect(selection.focusOffset).toBe(2);
		expect(selection.toString()).toBe('ell');
	});

	it('publishes explicit native formatting without losing the active model lease', () => {
		const { docs, editors } = peers();
		const snapshot = {
			elementId: 'e1',
			text: 'Hello',
			textSegments: [{ text: 'Hello', style: { bold: true } }],
		};
		expect(editors[0].controller.format(snapshot)).toMatchObject({ kind: 'supported', snapshot });
		for (const doc of docs) {
			expect(readSlidesFromYDoc(doc)[0].elements[0]).toMatchObject({
				textSegments: snapshot.textSegments,
			});
		}
		expect(editors[0].onCancel).not.toHaveBeenCalled();
	});

	it.each([false, true])(
		'immediately retires exactly once when authority is revoked (composing=%s)',
		async (composing) => {
			const { docs, editors } = peers();
			const root = editors[0].root;
			const node = root.querySelector('span')!.firstChild as Text;
			window.getSelection()!.setBaseAndExtent(node, 5, node, 5);
			if (composing) {
				root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
				node.data += 'UNREADY';
			}
			expect(editors[0].controller.readAccepted()?.text).toBe('Hello');
			editors[0].patcher.configure(null, null);
			expect(editors[0].onCancel).toHaveBeenCalledOnce();
			expect(editors[0].controller.readAccepted()).toBeUndefined();
			root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
			await Promise.resolve();
			editors[0].patcher.dispose();
			expect(editors[0].onCancel).toHaveBeenCalledOnce();
			for (const doc of docs) {
				expect(readSlidesFromYDoc(doc)[0].elements[0]).toMatchObject({ text: 'Hello' });
			}
		},
	);

	it('leaves the existing editing surface untouched when collaboration is inactive', () => {
		const root = document.createElement('div');
		root.textContent = 'existing';
		expect(
			attachCollaborationInlineEditor(root, element, { patcher: createCollaborationLivePatcher() }),
		).toBeUndefined();
		expect(root.textContent).toBe('existing');
	});

	it('publishes ordinary typing without replacing the native text node', () => {
		const { docs, editors } = peers();
		const node = editors[0].root.querySelector('span')!.firstChild;
		type(editors[0].root, 5, '!');
		expect(editors[0].root.querySelector('span')!.firstChild).toBe(node);
		for (const editor of editors) {
			expect(editor.root.textContent).toBe('Hello!');
		}
		for (const doc of docs) {
			expect(readSlidesFromYDoc(doc)[0].elements[0]).toMatchObject({ text: 'Hello!' });
		}
		expect(editors[0].onCancel).not.toHaveBeenCalled();
	});

	it('merges remote text received between native beforeinput and input', () => {
		const { docs, editors } = peers();
		const node = begin(editors[1].root, 5);
		expect(editors[1].controller.read()).toMatchObject({
			kind: 'unsupported',
			reason: 'input-active',
		});
		type(editors[0].root, 0, 'A');
		expect(editors[1].root.textContent).toBe('Hello');
		finish(editors[1].root, node, 5, 'B');
		for (const editor of editors) {
			expect(editor.root.textContent).toBe('AHelloB');
		}
		for (const doc of docs) {
			expect(readSlidesFromYDoc(doc)[0].elements[0]).toMatchObject({ text: 'AHelloB' });
		}
	});

	it('defers remote painting and Save while composition is active', async () => {
		const { editors } = peers();
		const root = editors[1].root;
		const node = root.querySelector('span')!.firstChild as Text;
		window.getSelection()!.setBaseAndExtent(node, 5, node, 5);
		root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
		node.data += '中';
		root.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
		type(editors[0].root, 0, 'A');
		expect(root.textContent).toBe('Hello中');
		expect(editors[1].controller.read()).toMatchObject({
			kind: 'unsupported',
			reason: 'composition-active',
		});
		root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
		await Promise.resolve();
		for (const editor of editors) {
			expect(editor.root.textContent).toBe('AHello中');
		}
	});

	it('retires before Undo reconciliation instead of skipping an explicit model replacement', () => {
		const { docs, editors } = peers();
		type(editors[0].root, 5, '!');
		const undone = { ...element, text: 'Before', textSegments: [{ text: 'Before', style: {} }] };
		reconcileSlidesInYDoc(
			[{ id: 's1', slideNumber: 1, elements: [undone] }],
			docs[0],
			factories(docs[0]),
		);
		expect(editors[0].onCancel).toHaveBeenCalledOnce();
		expect(editors[0].controller.read()).toMatchObject({
			kind: 'unsupported',
			reason: 'inactive-session',
		});
		expect(readSlidesFromYDoc(docs[0])[0].elements[0]).toMatchObject({ text: 'Before' });
	});
});
