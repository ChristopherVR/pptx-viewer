import type { PptxElement } from 'pptx-viewer-core';
import type {
	CollaborationLivePatcher,
	InlineListReadResult,
	InlineTextEditSnapshot,
	InlineTextSelection,
} from 'pptx-viewer-shared';

import type { OverlayBox } from './selection-overlay';

export interface InlineEditorSession {
	el: HTMLElement;
	/** Recognize a merged model revision before the ordinary model replacement guard. */
	checkModel?: (model: PptxElement | undefined) => boolean;
	/** Canonical accepted state only, for retirement before a host permission veto. */
	readAccepted?: () => InlineTextEditSnapshot | undefined;
	activateList(element: PptxElement): boolean | undefined;
	readSnapshot(): InlineTextEditSnapshot | undefined;
	readList(): InlineListReadResult | undefined;
	formatSnapshot(snapshot: InlineTextEditSnapshot): boolean;
	/** Commit the current text (fires `onCommit` when changed) and close. */
	commit(): void;
	/** Close without committing. */
	cancel(): void;
}

export interface OpenInlineEditorOptions {
	doc: Document;
	/** The editor overlay root the surface mounts into. */
	overlayRoot: HTMLElement;
	/** Element geometry in element px, plus the stage scale for placement. */
	box: OverlayBox;
	scale: number;
	element: PptxElement;
	spellCheck?: boolean;
	/** Use the existing connected slide channel, never create another session. */
	collaboration?: { patcher: CollaborationLivePatcher; slideId?: string };
	/** Called with the edited text on commit (only when it changed). */
	onCommit(text: string, snapshot?: InlineTextEditSnapshot): void;
	/**
	 * Called with the edited text on EVERY keystroke. Used for the collaboration
	 * live preview only: it must not touch editor state or history.
	 */
	onInput?(text: string, snapshot?: InlineTextEditSnapshot): void;
	onSelectionChange?(selection: InlineTextSelection | null): void;
	/** Called after the surface closes (commit or cancel). */
	onClose(): void;
}
