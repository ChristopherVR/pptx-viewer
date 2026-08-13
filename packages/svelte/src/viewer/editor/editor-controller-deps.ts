import type { PptxSlide } from 'pptx-viewer-core';
import type { CollaborationLivePatcher } from 'pptx-viewer-shared';

import type { ContextMenuCellTarget } from './context-menu-dispatch';

export interface EditorControllerDeps {
	getScale(): number;
	getCurrent(): number;
	getPresenting(): boolean;
	getStageRoot(): Element | null;
	getHolderEl(): HTMLElement | null;
	/**
	 * The focusable viewer root. The stage gesture preventDefault()s the click, so
	 * focus has to be put back here or the root's keydown listener stops seeing
	 * anything (see `armEditorKeyboard`).
	 */
	getRootEl?(): HTMLElement | null;
	onCursorMove?(x: number, y: number): void;
	/**
	 * Open the canvas context menu at viewport `x`/`y`. `cell` is the table cell
	 * the right-click landed on (null elsewhere): the menu's row / column /
	 * merge commands need a target, and this binding has no cell-selection
	 * model, so the cell under the pointer is the target.
	 */
	onContextMenu?(x: number, y: number, cell: ContextMenuCellTarget | null): void;
	getSnapToGrid?(): boolean;
	getSnapToShape?(): boolean;
	getGuides?(): readonly { axis: 'h' | 'v'; position: number }[];
	/**
	 * Transform inline-editor text at commit time (File > Options > Proofing
	 * AutoCorrect); identity when unset.
	 */
	transformCommittedText?(text: string): string;
	/**
	 * Collaboration live-preview channel. Inline text only reaches the slides
	 * state on commit, so peers saw nothing while a peer typed; each keystroke is
	 * published through this instead. Omit outside a collaborative viewer.
	 */
	getLivePatcher?(): CollaborationLivePatcher | undefined;
	/** The slide the inline-edited element belongs to (live-preview lookup). */
	getActiveSlide?(): PptxSlide | undefined;
	/**
	 * Show or hide the keyboard-shortcut cheat sheet ("?"). The panel is parity
	 * UI state owned by the shell, so the controller only signals the intent.
	 */
	toggleShortcuts?(): void;
	/** Close the cheat sheet on Escape; true when it was open (Escape consumed). */
	closeShortcuts?(): boolean;
	/**
	 * Open or close the find bar (Ctrl/Cmd+F). Like the cheat sheet, the panel is
	 * shell-owned UI state, so the controller only signals the intent.
	 */
	toggleFind?(): void;
}
