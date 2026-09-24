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
} from 'pptx-viewer-shared';
import { useCallback, useState } from 'react';

import { renderElementToRasterDataUrl } from '../utils/export-helpers';
import type { ElementOperations } from './element-operations-types';

/** The pasted element the "Paste Options" toolbar is currently anchored to. */
export interface PasteOptionsToolbarState {
	elementId: string;
	/** The pristine "Keep Source Formatting" clone every choice re-derives from. */
	sourceClone: PptxElement;
}

export interface UsePasteSpecialInput {
	clipboardPayload: { element: PptxElement; isTemplate: boolean } | null;
	editTemplateMode: boolean;
	ops: ElementOperations;
	markDirty: () => void;
}

export interface UsePasteSpecialResult {
	isPasteSpecialDialogOpen: boolean;
	openPasteSpecialDialog: () => void;
	closePasteSpecialDialog: () => void;
	/** Ctrl+Alt+V / dialog OK: paste the clipboard element in the chosen format. */
	pasteWithFormat: (format: PasteSpecialFormat) => Promise<void>;
	/** The Paste Options toolbar shown right after an ordinary Ctrl+V paste. */
	pasteOptionsToolbar: PasteOptionsToolbarState | null;
	/** Record an ordinary paste's result so the toolbar has something to reformat. */
	notePastedElement: (element: PptxElement) => void;
	/** Re-derive the pasted element in `format` from the frozen source clone. */
	reformatPastedElement: (format: PasteSpecialFormat) => Promise<void>;
	dismissPasteOptionsToolbar: () => void;
}

/** The mounted DOM node for `elementId`, matching the "Save as Picture" lookup. */
function findMountedElementNode(elementId: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(
		`[data-element-id="${elementId}"][data-pptx-element="true"]`,
	);
}

/** Rasterise the mounted node for `elementId` to a PNG data URL, or null if unmounted. */
async function rasterizePastedNode(elementId: string): Promise<string | null> {
	const node = findMountedElementNode(elementId);
	if (!node) {
		return null;
	}
	return renderElementToRasterDataUrl(node, 2);
}

export function usePasteSpecial(input: UsePasteSpecialInput): UsePasteSpecialResult {
	const { clipboardPayload, editTemplateMode, ops, markDirty } = input;
	const [isPasteSpecialDialogOpen, setIsPasteSpecialDialogOpen] = useState(false);
	const [pasteOptionsToolbar, setPasteOptionsToolbar] = useState<PasteOptionsToolbarState | null>(
		null,
	);

	const openPasteSpecialDialog = useCallback(() => {
		if (clipboardPayload) {
			setIsPasteSpecialDialogOpen(true);
		}
	}, [clipboardPayload]);
	const closePasteSpecialDialog = useCallback(() => setIsPasteSpecialDialogOpen(false), []);
	const dismissPasteOptionsToolbar = useCallback(() => setPasteOptionsToolbar(null), []);

	const notePastedElement = useCallback((element: PptxElement) => {
		setPasteOptionsToolbar({ elementId: element.id, sourceClone: element });
	}, []);

	/** Replace the pasted element with `next`, once rasterization (if any) settles. */
	const replacePastedElement = useCallback(
		(elementId: string, next: PptxElement) => {
			ops.updateActiveElements((els) => els.map((el) => (el.id === elementId ? next : el)));
			markDirty();
		},
		[ops, markDirty],
	);

	const pasteWithFormat = useCallback(
		async (format: PasteSpecialFormat) => {
			if (!clipboardPayload) {
				return;
			}
			setIsPasteSpecialDialogOpen(false);
			const sourceClone = cloneElementForPaste(clipboardPayload.element, {
				intoTemplate: editTemplateMode,
			});
			// "Picture" is inserted as the plain clone first (there is nothing to
			// rasterize before it is mounted); every other format applies immediately.
			const initial =
				format === 'picture' ? sourceClone : applyPasteSpecialFormat(sourceClone, format);
			ops.updateActiveElements((els) => [...els, initial]);
			ops.applySelection(initial.id);
			markDirty();
			setPasteOptionsToolbar({ elementId: initial.id, sourceClone });
			if (format === 'picture') {
				await new Promise<void>((resolve) => {
					requestAnimationFrame(() => resolve());
				});
				const dataUrl = await rasterizePastedNode(initial.id);
				if (dataUrl) {
					replacePastedElement(initial.id, buildRasterPictureElement(sourceClone, dataUrl));
				}
			}
		},
		[clipboardPayload, editTemplateMode, ops, markDirty, replacePastedElement],
	);

	const reformatPastedElement = useCallback(
		async (format: PasteSpecialFormat) => {
			const toolbar = pasteOptionsToolbar;
			if (!toolbar) {
				return;
			}
			if (format === 'picture') {
				const dataUrl = await rasterizePastedNode(toolbar.elementId);
				if (dataUrl) {
					replacePastedElement(
						toolbar.elementId,
						buildRasterPictureElement(toolbar.sourceClone, dataUrl),
					);
				}
				return;
			}
			replacePastedElement(toolbar.elementId, applyPasteSpecialFormat(toolbar.sourceClone, format));
		},
		[pasteOptionsToolbar, replacePastedElement],
	);

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
