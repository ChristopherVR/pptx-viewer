import type { ResizeHandleId, ShapeAdjustmentHandleDescriptor } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';
import type { SelectionOverlay } from './selection-overlay';

export interface StageInteractionsDeps {
	doc: Document;
	store: Store<ViewerState>;
	ops: EditorOps;
	getScale(): number;
	getOverlay(): SelectionOverlay | null;
	getStageRoot(): Element | null;
	getLivePatcher?(): import('pptx-viewer-shared').CollaborationLivePatcher | undefined;
	onCursorMove?: (x: number, y: number) => void;
	/**
	 * Mirror in-progress inline-editor text to collaborators. Called on every
	 * keystroke; the commit path is untouched. Omit outside a collaborative
	 * viewer.
	 */
	onInlineTextInput?: (elementId: string, text: string) => void;
	/** Push any queued live-preview frame out before a commit lands. */
	flushInlineTextInput?: () => void;
	onEditEquation?(id: string, omml: Record<string, unknown>): void;
	onEyedropper?(color: string): void;
	/** See `OpenInlineEditorOptions.onLiveFormatKey`; threaded straight through. */
	onInlineLiveFormatKey?(event: KeyboardEvent): boolean;
}

export interface StageInteractions {
	hasActivePointerInteraction(): boolean;
	readPendingInlineTextEdit?(): import('pptx-viewer-shared').PendingInlineTextEdit | undefined;
	readInlineList?(): import('pptx-viewer-shared').InlineListReadResult | undefined;
	/** Preserve exact accepted text before host-only permission loss closes the editor. */
	retainAcceptedInlineText?(): void;
	formatInlineList?(snapshot: import('pptx-viewer-shared').InlineTextEditSnapshot): boolean;
	onStagePointerDown(event: PointerEvent): void;
	onStagePointerMove(event: PointerEvent): void;
	onStageDblClick(event: MouseEvent): void;
	beginHandleGesture(kind: 'resize' | 'rotate', event: PointerEvent, handle?: ResizeHandleId): void;
	/** Begin dragging the amber shape-adjustment (`a:avLst`) diamond. */
	beginAdjustGesture(event: PointerEvent, descriptor: ShapeAdjustmentHandleDescriptor): void;
	closeInline(commit: boolean): void;
	inlineActive(): boolean;
	dispose(): void;
}
