/**
 * useShapeFormatCommands: builds the {@link ShapeFormatCommands} value the
 * viewer provides to the ribbon, the context menu and the crop overlay.
 */
import type { ShapeFormatCommands } from '../components/shape-format-context';
import type { ViewerMode } from '../types';
import type { EditorHistoryResult } from './useEditorHistory';
import type { EditorOperationsResult } from './useEditorOperations';
import { usePictureCropMode } from './usePictureCropMode';
import type { ViewerState } from './useViewerState';

export interface UseShapeFormatCommandsInput {
	state: ViewerState;
	editorOps: Pick<EditorOperationsResult, 'ops' | 'manipulation'>;
	history: Pick<EditorHistoryResult, 'markDirty'>;
	canEdit: boolean;
	mode: ViewerMode;
}

export function useShapeFormatCommands(input: UseShapeFormatCommandsInput): ShapeFormatCommands {
	const { state, editorOps, history, canEdit, mode } = input;
	const editable = canEdit && mode === 'edit';
	const crop = usePictureCropMode({
		cropSession: state.cropSession,
		cropSessionRef: state.cropSessionRef,
		setCropSession: state.setCropSession,
		editable,
		selectedElement: state.selectedElement,
		effectiveSelectedIds: state.effectiveSelectedIds,
		elementLookup: state.elementLookup,
		activeSlideIndex: state.activeSlideIndex,
		updateElementById: editorOps.ops.updateElementById,
		markDirty: history.markDirty,
	});
	const { canMergeShapes, handleMergeShapes } = editorOps.manipulation;
	// A fresh value each render: `crop` itself tracks the live selection.
	return {
		canMergeShapes: editable && canMergeShapes,
		mergeShapes: (operation) => {
			if (editable) {
				handleMergeShapes(operation);
			}
		},
		crop,
	};
}
