import type { ImagePptxElement } from 'pptx-viewer-core';

import type { CanvasSize } from '../types';
import { createImageElementFromFile } from './image-file-insertion';

/** A currently editable slide. Return null while loading or outside canvas editing. */
export interface EditorImagePasteTarget {
	documentId: object;
	slideId: string;
	canvasSize: CanvasSize;
}

export interface EditorImagePasteOptions {
	getCanvas(): HTMLElement | null;
	getTarget(): EditorImagePasteTarget | null;
	/** Use the normal editor command so selection, dirty state and Undo stay consistent. */
	insertElement(element: ImagePptxElement): void;
}

const ROOT_ATTRIBUTE = 'data-pptx-image-paste-root';
const TEXT_OR_DIALOG =
	'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
	'[role="textbox"], [role="menu"], [role="menuitem"], [role="dialog"], dialog';

function isCanvasTarget(root: HTMLElement, canvas: HTMLElement, node: EventTarget | null): boolean {
	const element = node as Element | null;
	return Boolean(
		element?.nodeType === 1 &&
		(element === root || canvas.contains(element)) &&
		element.closest(`[${ROOT_ATTRIBUTE}]`) === root &&
		!element.closest(TEXT_OR_DIALOG),
	);
}

function imageFile(clipboard: DataTransfer | null): File | null {
	if (!clipboard) {
		return null;
	}
	const file = Array.from(clipboard.files).find((entry) => entry.type.startsWith('image/'));
	if (file) {
		return file;
	}
	for (const item of Array.from(clipboard.items)) {
		if (item.kind === 'file' && item.type.startsWith('image/')) {
			const image = item.getAsFile();
			if (image) {
				return image;
			}
		}
	}
	return null;
}

/**
 * Handle native image paste for one focused canvas, without changing the
 * editor's internal element-clipboard keyboard priority. Bind once per viewer.
 * Dispose on document/load/slide transitions as well as unmount, including an
 * away-and-back navigation or a reload that reuses the same handler object.
 */
export function attachEditorImagePaste(
	root: HTMLElement,
	options: EditorImagePasteOptions,
): () => void {
	const previousRootAttribute = root.getAttribute(ROOT_ATTRIBUTE);
	const previousTabIndex = root.getAttribute('tabindex');
	root.setAttribute(ROOT_ATTRIBUTE, '');
	if (previousTabIndex === null) {
		root.tabIndex = 0;
	}
	const pending = new Set<AbortController>();
	let disposed = false;
	const cancelPending = (): void => {
		for (const abort of pending) {
			abort.abort();
		}
		pending.clear();
	};
	const onFocusIn = (event: FocusEvent): void => {
		const canvas = options.getCanvas();
		if (!canvas || !isCanvasTarget(root, canvas, event.target)) {
			cancelPending();
		}
	};
	const onPointerDown = (event: PointerEvent): void => {
		const canvas = options.getCanvas();
		if (
			event.button === 0 &&
			canvas &&
			root.isConnected &&
			root.contains(canvas) &&
			canvas.contains(event.target as Node) &&
			isCanvasTarget(root, canvas, event.target)
		) {
			// Keep native paste routed here after a prevented canvas gesture, even
			// when focus previously belonged to a ribbon button or inline editor.
			root.focus({ preventScroll: true });
		}
	};

	const onPaste = (event: ClipboardEvent): void => {
		const canvas = options.getCanvas();
		if (
			disposed ||
			event.defaultPrevented ||
			!canvas ||
			!root.isConnected ||
			!root.contains(canvas) ||
			!isCanvasTarget(root, canvas, event.target) ||
			!isCanvasTarget(root, canvas, root.ownerDocument.activeElement)
		) {
			return;
		}
		const target = options.getTarget();
		if (
			!target ||
			!Number.isFinite(target.canvasSize.width) ||
			target.canvasSize.width <= 0 ||
			!Number.isFinite(target.canvasSize.height) ||
			target.canvasSize.height <= 0
		) {
			return;
		}
		const { documentId, slideId } = target;
		const file = imageFile(event.clipboardData);
		if (!file || file.size === 0) {
			return;
		}
		event.preventDefault();
		const abort = new AbortController();
		pending.add(abort);
		void createImageElementFromFile(file, target.canvasSize, abort.signal).then((element) => {
			pending.delete(abort);
			if (!element || disposed || abort.signal.aborted || !root.isConnected) {
				return;
			}
			const current = options.getTarget();
			if (current?.documentId === documentId && current.slideId === slideId) {
				options.insertElement(element);
			}
			return undefined;
		});
	};
	root.addEventListener('paste', onPaste);
	root.addEventListener('pointerdown', onPointerDown, true);
	root.addEventListener('focusin', onFocusIn);
	return () => {
		if (disposed) {
			return;
		}
		disposed = true;
		root.removeEventListener('paste', onPaste);
		root.removeEventListener('pointerdown', onPointerDown, true);
		root.removeEventListener('focusin', onFocusIn);
		cancelPending();
		if (previousTabIndex === null) {
			root.removeAttribute('tabindex');
		}
		if (previousRootAttribute === null) {
			root.removeAttribute(ROOT_ATTRIBUTE);
		} else {
			root.setAttribute(ROOT_ATTRIBUTE, previousRootAttribute);
		}
	};
}
