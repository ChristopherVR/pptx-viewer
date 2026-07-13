import type { ResizeHandleId } from 'pptx-viewer-shared';

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
	onCursorMove?: (x: number, y: number) => void;
	onEditEquation?(id: string, omml: Record<string, unknown>): void;
}

export interface StageInteractions {
	onStagePointerDown(event: PointerEvent): void;
	onStagePointerMove(event: PointerEvent): void;
	onStageDblClick(event: MouseEvent): void;
	beginHandleGesture(kind: 'resize' | 'rotate', event: PointerEvent, handle?: ResizeHandleId): void;
	closeInline(commit: boolean): void;
	inlineActive(): boolean;
	dispose(): void;
}
