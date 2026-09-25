/**
 * useElementManipulation: Clipboard (copy/cut/paste/duplicate), group/ungroup,
 * delete, flip, align, layer-order, and context-menu dispatch handlers.
 *
 * Handler logic is split across sub-hooks; this module composes them and
 * provides the context-menu dispatch.
 */
import { contextMenuInspectorAnchor, scrollInspectorSectionIntoView } from 'pptx-viewer-shared';

import type { ElementContextMenuAction } from '../types';
import type {
	UseElementManipulationInput,
	ElementManipulationHandlers,
} from './element-manipulation-types';
import { useClipboardHandlers } from './useClipboardHandlers';
import { useGroupAlignLayerHandlers } from './useGroupAlignLayerHandlers';

/** Switch to the properties tab and, once mounted, scroll `anchor` into view. */
function focusInspectorSection(
	setIsInspectorPaneOpen: (open: boolean) => void,
	setSidebarPanelMode: (mode: string) => void,
	anchor: ReturnType<typeof contextMenuInspectorAnchor>,
): void {
	setIsInspectorPaneOpen(true);
	setSidebarPanelMode('properties');
	if (!anchor) {
		return;
	}
	// Two frames: one for React to commit the tab switch, one for layout to
	// settle, before `scrollIntoView` can find the tagged section.
	requestAnimationFrame(() => {
		requestAnimationFrame(() => scrollInspectorSectionIntoView(document, anchor));
	});
}

export type {
	UseElementManipulationInput,
	ElementManipulationHandlers,
} from './element-manipulation-types';

export function useElementManipulation(
	input: UseElementManipulationInput,
): ElementManipulationHandlers {
	const {
		selectedElement,
		setIsInspectorPaneOpen,
		setSidebarPanelMode,
		onOpenHyperlinkDialog,
		onEditText,
		onEditPoints,
		onSaveElementAsPicture,
	} = input;

	const { handleCopy, handleCut, handlePaste, handleDuplicate, handleDelete } =
		useClipboardHandlers(input);

	const {
		handleGroupElements,
		handleUngroupElement,
		handleFlip,
		handleAlignElements,
		handleDistributeElements,
		canDistribute,
		selectionGroupable,
		handleMoveLayer,
		handleMoveLayerToEdge,
		handleMergeShapes,
		canMergeShapes,
	} = useGroupAlignLayerHandlers(input);

	const handleContextMenuAction = (action: ElementContextMenuAction) => {
		switch (action) {
			case 'copy':
				handleCopy();
				break;
			case 'cut':
				handleCut();
				break;
			case 'paste':
				handlePaste();
				break;
			case 'duplicate':
				handleDuplicate();
				break;
			case 'delete':
				handleDelete();
				break;
			case 'bring-forward':
			case 'bringForward':
				handleMoveLayer('forward');
				break;
			case 'send-backward':
			case 'sendBackward':
				handleMoveLayer('backward');
				break;
			case 'bring-front':
			case 'bringToFront':
				handleMoveLayerToEdge('front');
				break;
			case 'send-back':
			case 'sendToBack':
				handleMoveLayerToEdge('back');
				break;
			case 'comment':
			case 'addComment':
				setIsInspectorPaneOpen(true);
				setSidebarPanelMode('comments');
				break;
			case 'group':
				handleGroupElements();
				break;
			case 'ungroup':
				handleUngroupElement();
				break;
			case 'editHyperlink':
				onOpenHyperlinkDialog();
				break;
			case 'edit-text':
				if (selectedElement) {
					onEditText?.(selectedElement.id);
				}
				break;
			case 'edit-points':
			case 'editPoints':
				if (selectedElement) {
					onEditPoints?.(selectedElement.id);
				}
				break;
			case 'save-as-picture':
				if (selectedElement) {
					onSaveElementAsPicture?.(selectedElement.id);
				}
				break;
			case 'edit-alt-text':
				focusInspectorSection(
					setIsInspectorPaneOpen,
					setSidebarPanelMode,
					contextMenuInspectorAnchor('edit-alt-text'),
				);
				break;
			case 'size-and-position':
				focusInspectorSection(
					setIsInspectorPaneOpen,
					setSidebarPanelMode,
					contextMenuInspectorAnchor('size-and-position'),
				);
				break;
			case 'format-shape':
				focusInspectorSection(
					setIsInspectorPaneOpen,
					setSidebarPanelMode,
					contextMenuInspectorAnchor('format-shape'),
				);
				break;
		}
	};

	return {
		handleCopy,
		handleCut,
		handlePaste,
		handleDuplicate,
		handleGroupElements,
		handleUngroupElement,
		handleDelete,
		handleFlip,
		handleAlignElements,
		handleDistributeElements,
		canDistribute,
		selectionGroupable,
		handleMoveLayer,
		handleMoveLayerToEdge,
		handleMergeShapes,
		canMergeShapes,
		handleContextMenuAction,
	};
}
