/**
 * usePasteSpecial: Paste Special (Ctrl+Alt+V) + the Paste Options mini-toolbar
 * PowerPoint shows right after an ordinary paste.
 *
 * Both surfaces offer the same four choices (`PASTE_SPECIAL_OPTIONS` in
 * `pptx-viewer-shared`), applied to one frozen "source clone" (the clipboard
 * element as `cloneElementForPaste` already positions and re-ids it).
 * Re-deriving from that frozen clone on every choice, rather than
 * transforming the already-transformed element, is what keeps repeated
 * clicks non-cumulative: picking "Keep Text Only" then "Use Destination
 * Theme" must not compound, it must re-derive from the original paste, which
 * is how PowerPoint's own Paste Options toolbar behaves.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import {
	applyPasteSpecialFormat,
	buildRasterPictureElement,
	cloneElementForPaste,
	findCanvasElementNode,
	isTemplateElementId,
	rasterizeElementToDataUrl,
} from 'pptx-viewer-shared';
import { ref, shallowRef } from 'vue';
import type { Ref, ShallowRef } from 'vue';

import { renderToCanvas } from '../../lib/canvas-export';
import type { EditorOperations } from './useEditorOperations';

/** The pasted element the "Paste Options" toolbar is currently anchored to. */
export interface PasteOptionsToolbarState {
	elementId: string;
	/** The pristine "Keep Source Formatting" clone every choice re-derives from. */
	sourceClone: PptxElement;
}

export interface UsePasteSpecialInput {
	clipboard: Ref<PptxElement | null>;
	ops: EditorOperations;
	selectedElementIds: Ref<string[]>;
}

export interface UsePasteSpecialResult {
	isPasteSpecialDialogOpen: Ref<boolean>;
	openPasteSpecialDialog: () => void;
	closePasteSpecialDialog: () => void;
	/** Ctrl+Alt+V / dialog OK: paste the clipboard element in the chosen format. */
	pasteWithFormat: (format: PasteSpecialFormat) => Promise<void>;
	/** The Paste Options toolbar shown right after an ordinary Ctrl+V paste. */
	pasteOptionsToolbar: ShallowRef<PasteOptionsToolbarState | null>;
	/** Record an ordinary paste's result so the toolbar has something to reformat. */
	notePastedElement: (element: PptxElement) => void;
	/** Re-derive the pasted element in `format` from the frozen source clone. */
	reformatPastedElement: (format: PasteSpecialFormat) => Promise<void>;
	dismissPasteOptionsToolbar: () => void;
}

/** The mounted DOM node for `elementId`, matching the context-menu's own lookup. */
function findElementNode(elementId: string): HTMLElement | null {
	return findCanvasElementNode(document, elementId);
}

/** Rasterise the mounted node for `elementId` to a PNG data URL, or null if unmounted. */
async function rasterizePastedNode(elementId: string): Promise<string | null> {
	const node = findElementNode(elementId);
	if (!node) {
		return null;
	}
	const rect = node.getBoundingClientRect();
	const width = rect.width || node.offsetWidth;
	const height = rect.height || node.offsetHeight;
	return rasterizeElementToDataUrl(node, width, height, document, {
		scale: 2,
		html2canvasFallback: (sourceRect, outputSize) =>
			renderToCanvas(node, {
				scale: outputSize.width / (sourceRect.width || 1),
				x: sourceRect.x,
				y: sourceRect.y,
				width: sourceRect.width,
				height: sourceRect.height,
				useCORS: true,
				allowTaint: true,
				logging: false,
			}),
	});
}

export function usePasteSpecial(input: UsePasteSpecialInput): UsePasteSpecialResult {
	const { clipboard, ops, selectedElementIds } = input;
	const isPasteSpecialDialogOpen = ref(false);
	// shallowRef: the state holds an unmodified PptxElement clone that
	// `structuredClone` (via `cloneElementForPaste`) must be able to clone on
	// the next choice; a deep-reactive `ref()` wraps it in a Proxy first, which
	// `structuredClone` cannot clone (the same gotcha `useElementClipboard`'s
	// own clipboard buffer documents).
	const pasteOptionsToolbar = shallowRef<PasteOptionsToolbarState | null>(null);

	function openPasteSpecialDialog(): void {
		if (clipboard.value) {
			isPasteSpecialDialogOpen.value = true;
		}
	}
	function closePasteSpecialDialog(): void {
		isPasteSpecialDialogOpen.value = false;
	}
	function dismissPasteOptionsToolbar(): void {
		pasteOptionsToolbar.value = null;
	}
	function notePastedElement(element: PptxElement): void {
		pasteOptionsToolbar.value = { elementId: element.id, sourceClone: element };
	}

	async function pasteWithFormat(format: PasteSpecialFormat): Promise<void> {
		if (!clipboard.value) {
			return;
		}
		isPasteSpecialDialogOpen.value = false;
		const sourceClone = cloneElementForPaste(clipboard.value, {
			intoTemplate: isTemplateElementId(clipboard.value.id),
		});
		// "Picture" is inserted as the plain clone first (there is nothing to
		// rasterize before it is mounted); every other format applies immediately.
		const initial =
			format === 'picture' ? sourceClone : applyPasteSpecialFormat(sourceClone, format);
		ops.addElement(initial);
		selectedElementIds.value = [initial.id];
		pasteOptionsToolbar.value = { elementId: initial.id, sourceClone };
		if (format === 'picture') {
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => resolve());
			});
			const dataUrl = await rasterizePastedNode(initial.id);
			if (dataUrl) {
				ops.updateElement(initial.id, buildRasterPictureElement(sourceClone, dataUrl));
			}
		}
	}

	async function reformatPastedElement(format: PasteSpecialFormat): Promise<void> {
		const toolbar = pasteOptionsToolbar.value;
		if (!toolbar) {
			return;
		}
		if (format === 'picture') {
			const dataUrl = await rasterizePastedNode(toolbar.elementId);
			if (dataUrl) {
				ops.updateElement(
					toolbar.elementId,
					buildRasterPictureElement(toolbar.sourceClone, dataUrl),
				);
			}
			return;
		}
		ops.updateElement(toolbar.elementId, applyPasteSpecialFormat(toolbar.sourceClone, format));
	}

	return {
		isPasteSpecialDialogOpen,
		openPasteSpecialDialog,
		closePasteSpecialDialog,
		pasteWithFormat,
		pasteOptionsToolbar,
		notePastedElement,
		reformatPastedElement,
		dismissPasteOptionsToolbar,
	};
}
