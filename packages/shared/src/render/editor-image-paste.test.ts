// @vitest-environment jsdom
import type { ImagePptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachEditorImagePaste } from './editor-image-paste';
import type { EditorImagePasteTarget } from './editor-image-paste';
import { createImageElementFromFile } from './image-file-insertion';

vi.mock(import('./image-file-insertion'), () => ({ createImageElementFromFile: vi.fn() }));

const image: ImagePptxElement = {
	id: 'pasted-image',
	type: 'image',
	x: 0,
	y: 0,
	width: 20,
	height: 10,
	imageData: 'data:image/png;base64,cGljdHVyZQ==',
};
const file = new File(['picture'], 'picture.png', { type: 'image/png' });
const disposers: (() => void)[] = [];

function setup(parent: HTMLElement = document.body) {
	const root = document.createElement('div');
	root.tabIndex = 0;
	const canvas = document.createElement('div');
	root.append(canvas);
	parent.append(root);
	let target: EditorImagePasteTarget | null = {
		documentId: {},
		slideId: 'slide-1',
		canvasSize: { width: 960, height: 540 },
	};
	const insertElement = vi.fn();
	const dispose = attachEditorImagePaste(root, {
		getCanvas: () => canvas,
		getTarget: () => target,
		insertElement,
	});
	disposers.push(dispose);
	root.focus();
	return {
		root,
		canvas,
		insertElement,
		dispose,
		getTarget: () => target,
		setTarget: (next: typeof target) => {
			target = next;
		},
	};
}

function paste(
	target: HTMLElement,
	files: File[] = [file],
	items: Partial<DataTransferItem>[] = [],
	prevented = false,
) {
	const event = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clipboardData', { value: { files, items } });
	if (prevented) {
		event.preventDefault();
	}
	target.dispatchEvent(event);
	return event;
}

beforeEach(() => {
	vi.mocked(createImageElementFromFile).mockReset().mockResolvedValue(image);
});
afterEach(() => {
	for (const dispose of disposers.splice(0)) {
		dispose();
	}
	document.body.replaceChildren();
	vi.clearAllMocks();
});

describe('attachEditorImagePaste', () => {
	it('decodes the first image once and commits through the existing insertion command', async () => {
		const editor = setup();
		const event = paste(editor.root, [
			new File(['text'], 'text.txt', { type: 'text/plain' }),
			file,
			file,
		]);
		expect(event.defaultPrevented).toBeTruthy();
		expect(createImageElementFromFile).toHaveBeenCalledExactlyOnceWith(
			file,
			{ width: 960, height: 540 },
			expect.any(AbortSignal),
		);
		await Promise.resolve();
		expect(editor.insertElement).toHaveBeenCalledExactlyOnceWith(image);
	});

	it('accepts the file-items form when files is empty', async () => {
		const editor = setup();
		paste(editor.root, [], [{ kind: 'file', type: 'image/png', getAsFile: () => file }]);
		await Promise.resolve();
		expect(editor.insertElement).toHaveBeenCalledOnce();
	});

	it('allows a canvas selection handle to own focus', async () => {
		const editor = setup();
		const handle = document.createElement('button');
		editor.canvas.append(handle);
		handle.focus();
		paste(handle);
		await Promise.resolve();
		expect(editor.insertElement).toHaveBeenCalledOnce();
	});

	it.each(['input', 'textarea', 'select', 'button'])('leaves a ribbon %s alone', (tag) => {
		const editor = setup();
		const control = document.createElement(tag);
		editor.root.append(control);
		control.focus();
		expect(paste(control).defaultPrevented).toBeFalsy();
		expect(createImageElementFromFile).not.toHaveBeenCalled();
	});

	it.each(['textbox', 'menu', 'menuitem', 'dialog'])(
		'leaves canvas descendants inside role=%s alone',
		(role) => {
			const editor = setup();
			const container = document.createElement('div');
			container.setAttribute('role', role);
			const control = document.createElement('button');
			container.append(control);
			editor.canvas.append(container);
			control.focus();
			expect(paste(control).defaultPrevented).toBeFalsy();
			expect(createImageElementFromFile).not.toHaveBeenCalled();
		},
	);

	it('leaves nested contenteditable children alone, including table text editors', () => {
		const editor = setup();
		const text = document.createElement('div');
		text.setAttribute('contenteditable', 'true');
		const child = document.createElement('span');
		text.append(child);
		editor.canvas.append(text);
		expect(paste(child).defaultPrevented).toBeFalsy();
		expect(createImageElementFromFile).not.toHaveBeenCalled();
	});

	it('ignores outside focus, already handled events, text and unsupported files', () => {
		const editor = setup();
		const input = document.createElement('input');
		document.body.append(input);
		input.focus();
		expect(paste(editor.root).defaultPrevented).toBeFalsy();
		editor.root.focus();
		paste(editor.root, [file], [], true);
		expect(paste(editor.root, []).defaultPrevented).toBeFalsy();
		expect(
			paste(editor.root, [new File(['text'], 'text.txt', { type: 'text/plain' })]).defaultPrevented,
		).toBeFalsy();
		expect(createImageElementFromFile).not.toHaveBeenCalled();
	});

	it('cannot bubble from a nested read-only viewer into the editable outer viewer', async () => {
		const outer = setup();
		const inner = setup(outer.canvas);
		inner.setTarget(null);
		expect(paste(inner.root).defaultPrevented).toBeFalsy();
		await Promise.resolve();
		expect(createImageElementFromFile).not.toHaveBeenCalled();
		expect(outer.insertElement).not.toHaveBeenCalled();
	});

	it('handles a nested editable viewer only once and leaves a sibling alone', async () => {
		const outer = setup();
		const sibling = setup();
		const inner = setup(outer.canvas);
		paste(inner.root);
		await Promise.resolve();
		expect(createImageElementFromFile).toHaveBeenCalledOnce();
		expect(inner.insertElement).toHaveBeenCalledOnce();
		expect(outer.insertElement).not.toHaveBeenCalled();
		expect(sibling.insertElement).not.toHaveBeenCalled();
	});

	it.each(['ineligible', 'document', 'slide'])(
		'rechecks %s after asynchronous decode',
		async (change) => {
			const editor = setup();
			let finish!: (result: ImagePptxElement) => void;
			vi.mocked(createImageElementFromFile).mockImplementation(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					}),
			);
			paste(editor.root);
			editor.setTarget(
				change === 'ineligible'
					? null
					: {
							documentId: change === 'document' ? {} : editor.getTarget()!.documentId,
							slideId: change === 'slide' ? 'slide-2' : 'slide-1',
							canvasSize: { width: 960, height: 540 },
						},
			);
			finish(image);
			await Promise.resolve();
			expect(editor.insertElement).not.toHaveBeenCalled();
		},
	);

	it('aborts pending decodes and removes the listener on lifecycle disposal', async () => {
		const editor = setup();
		let finish!: (result: ImagePptxElement) => void;
		vi.mocked(createImageElementFromFile).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		paste(editor.root);
		const signal = vi.mocked(createImageElementFromFile).mock.calls[0][2];
		editor.dispose();
		expect(signal?.aborted).toBeTruthy();
		expect(paste(editor.root).defaultPrevented).toBeFalsy();
		finish(image);
		await Promise.resolve();
		expect(editor.insertElement).not.toHaveBeenCalled();
	});

	it('does not insert an unreadable image', async () => {
		vi.mocked(createImageElementFromFile).mockResolvedValue(null);
		const editor = setup();
		paste(editor.root);
		await Promise.resolve();
		expect(editor.insertElement).not.toHaveBeenCalled();
	});

	it('snapshots identity even when the caller later mutates its target object', async () => {
		const editor = setup();
		let finish!: (result: ImagePptxElement) => void;
		vi.mocked(createImageElementFromFile).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		paste(editor.root);
		editor.getTarget()!.slideId = 'slide-2';
		finish(image);
		await Promise.resolve();
		expect(editor.insertElement).not.toHaveBeenCalled();
	});

	it('does not read destroyed framework state after the root is disconnected', async () => {
		const root = document.createElement('div');
		const canvas = document.createElement('div');
		root.append(canvas);
		document.body.append(root);
		let finish!: (result: ImagePptxElement) => void;
		vi.mocked(createImageElementFromFile).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const getTarget = vi.fn(() => ({
			documentId: {},
			slideId: 'slide',
			canvasSize: { width: 960, height: 540 },
		}));
		disposers.push(
			attachEditorImagePaste(root, { getCanvas: () => canvas, getTarget, insertElement: vi.fn() }),
		);
		root.focus();
		paste(root);
		getTarget.mockClear();
		root.remove();
		finish(image);
		await Promise.resolve();
		expect(getTarget).not.toHaveBeenCalled();
	});

	it('ignores zero-size files and invalid slide bounds without claiming paste', () => {
		const editor = setup();
		expect(
			paste(editor.root, [new File([], 'empty.png', { type: 'image/png' })]).defaultPrevented,
		).toBeFalsy();
		editor.getTarget()!.canvasSize.width = 0;
		expect(paste(editor.root).defaultPrevented).toBeFalsy();
		expect(createImageElementFromFile).not.toHaveBeenCalled();
	});

	it('does not remove a replacement listener marker when an old disposer runs twice', () => {
		const editor = setup();
		editor.dispose();
		const detach = attachEditorImagePaste(editor.root, {
			getCanvas: () => editor.canvas,
			getTarget: editor.getTarget,
			insertElement: editor.insertElement,
		});
		disposers.push(detach);
		editor.dispose();
		expect(editor.root.hasAttribute('data-pptx-image-paste-root')).toBeTruthy();
	});

	it('arms a headless root after an ordinary canvas press and restores its original tabindex', () => {
		const root = document.createElement('div');
		const canvas = document.createElement('div');
		root.append(canvas);
		document.body.append(root);
		const detach = attachEditorImagePaste(root, {
			getCanvas: () => canvas,
			getTarget: () => null,
			insertElement: vi.fn(),
		});
		disposers.push(detach);
		canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		expect(document.activeElement).toBe(root);
		expect(root.tabIndex).toBe(0);
		detach();
		expect(root.hasAttribute('tabindex')).toBeFalsy();
	});

	it('moves focus from ribbon and inline text to the canvas, without stealing actual text presses', () => {
		const editor = setup();
		const ribbon = document.createElement('button');
		editor.root.append(ribbon);
		ribbon.focus();
		editor.canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		expect(document.activeElement).toBe(editor.root);
		const text = document.createElement('textarea');
		editor.canvas.append(text);
		text.focus();
		text.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		expect(document.activeElement).toBe(text);
		editor.setTarget(null);
		editor.canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		expect(document.activeElement).toBe(editor.root);
	});

	it('cancels a pending decode when inline focus enters and leaves without a model update', async () => {
		const editor = setup();
		let finish!: (result: ImagePptxElement) => void;
		vi.mocked(createImageElementFromFile).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		paste(editor.root);
		const signal = vi.mocked(createImageElementFromFile).mock.calls[0][2];
		const text = document.createElement('input');
		editor.canvas.append(text);
		text.focus();
		editor.root.focus();
		expect(signal?.aborted).toBeTruthy();
		finish(image);
		await Promise.resolve();
		expect(editor.insertElement).not.toHaveBeenCalled();
	});

	it('arms canvas focus before a shape stops the pointer event from bubbling', () => {
		const editor = setup();
		const button = document.createElement('button');
		editor.root.append(button);
		button.focus();
		editor.canvas.addEventListener('pointerdown', (event) => event.stopPropagation());
		editor.canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		expect(document.activeElement).toBe(editor.root);
	});
});
