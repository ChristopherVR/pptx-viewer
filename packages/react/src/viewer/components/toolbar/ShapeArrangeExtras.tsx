import type { MergeShapeOperation, PptxElement, ShapeStyle } from 'pptx-viewer-core';
import type { RibbonHomeIntent, ToolbarActionId } from 'pptx-viewer-shared';
import {
	arrangeShapeHomeControls,
	canGroupSelection,
	canSetStrokeWidth,
	canUngroupSelection,
	parseCropValue,
	strokeWidthOf,
} from 'pptx-viewer-shared';
import React, { useCallback, useMemo } from 'react';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import { useShapeFormatContext } from '../shape-format-context';
import { WebHomeControls } from './WebHomeControls';

export interface ShapeArrangeExtrasProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	/** How many elements the multi-select currently holds; Group needs two. */
	selectedCount: number;
	/** Whether every selected element allows `a:spLocks/@noGrp` grouping. */
	selectionGroupable: boolean;
	onGroupElements: () => void;
	onUngroupElement: () => void;
	onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
	/** Host-hidden ribbon buttons (`mergeShapes`, `crop`). */
	hiddenActions?: readonly ToolbarActionId[];
}

/**
 * The Arrange group's shape-level extras (Group, Ungroup, Merge Shapes, Crop
 * and the outline width) as the shared `pptx-ui-ribbon-home-arrange-shape`
 * strip. Gating comes from shared; the merge and crop commands come from the
 * viewer's shape-format context.
 */
export function ShapeArrangeExtras(p: ShapeArrangeExtrasProps): React.ReactElement {
	const commands = useShapeFormatContext();
	const crop = commands?.crop;
	const { isHidden } = useToolbarVisibility(p.hiddenActions);
	const { onGroupElements, onUngroupElement, onUpdateElementStyle } = p;
	const controls = useMemo(
		() =>
			arrangeShapeHomeControls({
				editable: p.canEdit,
				canGroup: canGroupSelection(p.canEdit, p.selectedCount, p.selectionGroupable),
				canUngroup: canUngroupSelection(p.canEdit, p.selectedElement),
				canMerge: Boolean(commands?.canMergeShapes),
				canCrop: Boolean(crop?.canCrop),
				cropActive: Boolean(crop?.element),
				canStrokeWidth: canSetStrokeWidth(p.canEdit, p.selectedElement),
				strokeWidth: strokeWidthOf(p.selectedElement),
				hideMerge: isHidden('mergeShapes'),
				hideCrop: isHidden('crop'),
			}),
		[
			p.canEdit,
			p.selectedCount,
			p.selectionGroupable,
			p.selectedElement,
			commands?.canMergeShapes,
			crop?.canCrop,
			crop?.element,
			isHidden,
		],
	);
	const request = useCallback(
		(id: string, _part?: string, intent?: RibbonHomeIntent) => {
			const value = intent?.value;
			switch (id) {
				case 'home.arrange.group':
					onGroupElements();
					break;
				case 'home.arrange.ungroup':
					onUngroupElement();
					break;
				case 'home.arrange.mergeShapes':
					commands?.mergeShapes(value as MergeShapeOperation);
					break;
				case 'home.arrange.outlineWidth':
					onUpdateElementStyle({ strokeWidth: Math.max(0, Number(value)) });
					break;
				case 'home.arrange.crop': {
					const action = parseCropValue(value);
					if (!action) {
						crop?.toggle();
					} else if (action.kind === 'aspect') {
						crop?.cropToAspect(action.width, action.height);
					} else if (action.kind === 'fill') {
						crop?.fill();
					} else {
						crop?.fit();
					}
				}
			}
		},
		[onGroupElements, onUngroupElement, onUpdateElementStyle, commands, crop],
	);
	return <WebHomeControls family='arrange-shape' controls={controls} onRequest={request} />;
}
