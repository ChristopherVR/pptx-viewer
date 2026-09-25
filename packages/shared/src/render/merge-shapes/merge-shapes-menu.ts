/**
 * The Merge Shapes menu as data: one entry per operation with its i18n key and
 * the context-menu command id it answers to, so the ribbon dropdown and the
 * right-click entries in all five bindings list the same operations in the
 * same order under the same names.
 *
 * @module render/merge-shapes/merge-shapes-menu
 */
import type { MergeShapeOperation } from 'pptx-viewer-core';

import { MERGE_SHAPE_OPERATIONS } from './merge-shapes';

/** The right-click command id for each operation. */
export type MergeShapesCommandId =
	| 'merge-union'
	| 'merge-combine'
	| 'merge-fragment'
	| 'merge-intersect'
	| 'merge-subtract';

/** One Merge Shapes menu entry. */
export interface MergeShapesMenuItem {
	operation: MergeShapeOperation;
	/** Ribbon dropdown label key ("Union"). */
	labelKey: string;
	/** Context-menu label key ("Union Shapes"). */
	contextMenuLabelKey: string;
	commandId: MergeShapesCommandId;
}

/** The ribbon button's own label key ("Merge Shapes"). */
export const MERGE_SHAPES_LABEL_KEY = 'pptx.shape.mergeShapes';

/** Tooltip shown while the button is disabled. */
export const MERGE_SHAPES_HINT_KEY = 'pptx.shape.mergeShapesHint';

const CAPITALISED: Record<MergeShapeOperation, string> = {
	union: 'Union',
	combine: 'Combine',
	fragment: 'Fragment',
	intersect: 'Intersect',
	subtract: 'Subtract',
};

/** The five operations in PowerPoint's order. */
export const MERGE_SHAPES_MENU_ITEMS: readonly MergeShapesMenuItem[] = MERGE_SHAPE_OPERATIONS.map(
	(operation) => ({
		operation,
		labelKey: `pptx.shape.merge${CAPITALISED[operation]}`,
		contextMenuLabelKey: `pptx.contextMenu.merge${CAPITALISED[operation]}`,
		commandId: `merge-${operation}` as MergeShapesCommandId,
	}),
);

/** The operation a context-menu command runs, or null when it is not a merge command. */
export function mergeOperationForCommand(commandId: string): MergeShapeOperation | null {
	return MERGE_SHAPES_MENU_ITEMS.find((item) => item.commandId === commandId)?.operation ?? null;
}
