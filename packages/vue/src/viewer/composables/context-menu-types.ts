import type { PptxElement } from 'pptx-viewer-core';
import type { ResolvedCustomization } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';

import type { ContextMenuItem } from '../components/ContextMenu.vue';
import type { MergeCropController } from './merge-crop-context';
import type { TableSelectionState } from './table-selection';
import type { EditorOperations } from './useEditorOperations';

export interface ContextMenuState {
	open: boolean;
	x: number;
	y: number;
	elementId: string | null;
}

export interface UseContextMenuInput {
	slideIndex?: () => number;
	canEdit: () => boolean;
	findActiveElement: (id: string) => PptxElement | undefined;
	tableSelection: Ref<TableSelectionState | null>;
	hasClipboard: ComputedRef<boolean>;
	/**
	 * Two or more elements are selected. Ungroup needs no equivalent flag: the
	 * shared list derives it from the right-clicked element's own type, which is
	 * how React decides it too.
	 */
	canGroup: ComputedRef<boolean>;
	/** Lock-only half of Group/Ungroup gating (`a:spLocks`/`a:grpSpLocks` `@noGrp`); disables, not hides. */
	selectionGroupable: ComputedRef<boolean>;
	editTemplateMode: Ref<boolean>;
	selectedElementIds: Ref<string[]>;
	/**
	 * The element whose inline text editor is open, if any. The editor is a
	 * sibling overlay rather than a child of the element, so a right-click inside
	 * it hit-tests to nothing; this is what the menu falls back to.
	 */
	inlineEditingElementId: Ref<string | null>;
	/** Whether the properties inspector is open; the format-object trio opens it. */
	inspectorOpen: Ref<boolean>;
	/** "Edit Text": the same effect as double-clicking the element. */
	enterInlineEdit: (id: string) => void;
	ops: EditorOperations;
	cutElement: (id: string) => void;
	copyElement: (id: string) => void;
	pasteElement: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	openHyperlinkDialog: (id: string) => void;
	/** "Add Comment": open the comments panel, as React's menu does. */
	onAddComment?: () => void;
	/** Whether the AI assistant is enabled (adds the "Ask AI" / "Fix with AI" entries). */
	aiEnabled?: () => boolean;
	/** Open the AI panel scoped to the current element (empty composer). */
	onAskAi?: () => void;
	/** Open the AI panel with a prefilled "fix this element" directive (not sent). */
	onFixAi?: () => void;
	/**
	 * Right-click landed on empty canvas (no interactive element under the
	 * cursor). Wired to `useCanvasContextMenu`'s opener; when omitted the
	 * click is left unhandled (browser's own menu), matching the old behaviour.
	 */
	onEmptyCanvasContextMenu?: (x: number, y: number) => void;
	/** The host's resolved UI customisation (hidden commands / disabled menu). */
	customization?: () => ResolvedCustomization;
	/** "Edit Points": offered (per the shared lock / type rules) only when wired. */
	onEditPoints?: (element: PptxElement) => void;
	/** Merge Shapes + picture Crop (the `merge-*` and `crop` entries). */
	mergeCrop?: MergeCropController;
}

export interface UseContextMenuResult {
	contextMenu: Ref<ContextMenuState>;
	contextItems: ComputedRef<ContextMenuItem[]>;
	onCanvasContextMenu: (event: MouseEvent) => void;
	onContextSelect: (actionId: string) => void;
}
