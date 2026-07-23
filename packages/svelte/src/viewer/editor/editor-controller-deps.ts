import type { PptxSlide } from 'pptx-viewer-core';
import type { CollaborationLivePatcher } from 'pptx-viewer-shared';

export interface EditorControllerDeps {
	getScale(): number;
	getCurrent(): number;
	getPresenting(): boolean;
	getStageRoot(): Element | null;
	getHolderEl(): HTMLElement | null;
	onCursorMove?(x: number, y: number): void;
	onContextMenu?(x: number, y: number): void;
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
}
