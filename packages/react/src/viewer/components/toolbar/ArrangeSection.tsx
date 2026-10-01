import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { arrangeAlignAction, arrangeHomeControls } from 'pptx-viewer-shared';
import type { ToolbarActionId } from 'pptx-viewer-shared';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPaintbrush } from 'react-icons/lu';

import { cn } from '../../utils';
import { controlAttr, groupAttr } from './PowerPointRibbonControls';
import { ShapeArrangeExtras } from './ShapeArrangeExtras';
import { ic, pill } from './toolbar-constants';
import { WebHomeControls } from './WebHomeControls';

export interface ArrangeSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	/** How many elements the multi-select currently holds. */
	selectedCount: number;
	/** Whether every selected element allows `a:spLocks/@noGrp` grouping. */
	selectionGroupable: boolean;
	onAlignElements: (align: string) => void;
	onDistributeElements: (axis: string) => void;
	canDistribute: boolean;
	onFlip: (direction: 'horizontal' | 'vertical') => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
	onGroupElements: () => void;
	onUngroupElement: () => void;
	onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
	onDuplicate: () => void;
	onDelete: () => void;
	formatPainterActive?: boolean;
	onToggleFormatPainter?: () => void;
	canActivateFormatPainter?: boolean;
	/** Host-hidden ribbon buttons, for the Merge Shapes / Crop controls. */
	hiddenActions?: readonly ToolbarActionId[];
}

/**
 * Home > Arrange. Align/Distribute, Flip, layer order and Duplicate/Delete are
 * the shared `pptx-ui-ribbon-home-arrange-*` strips; the second Format Painter,
 * Group, Ungroup, Merge Shapes, Crop and the outline width stay native.
 */
export function ArrangeSection(p: ArrangeSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const {
		onAlignElements,
		onDistributeElements,
		onFlip,
		onMoveLayer,
		onMoveLayerToEdge,
		onDuplicate,
		onDelete,
	} = p;
	const controls = useMemo(
		() =>
			arrangeHomeControls({
				editable: p.canEdit,
				hasSelection: Boolean(p.selectedElement),
				canDistribute: p.canDistribute,
			}),
		[p.canEdit, p.selectedElement, p.canDistribute],
	);
	const requestAlign = useCallback(
		(_id: string, part?: string) => {
			const action = arrangeAlignAction(part);
			if (action?.kind === 'align') {
				onAlignElements(action.edge === 'centerH' ? 'center' : action.edge);
			} else if (action) {
				onDistributeElements(action.axis);
			}
		},
		[onAlignElements, onDistributeElements],
	);
	const requestFlip = useCallback(
		(id: string) => onFlip(id === 'home.arrange.flipHorizontal' ? 'horizontal' : 'vertical'),
		[onFlip],
	);
	const requestOrder = useCallback(
		(id: string) => {
			switch (id) {
				case 'home.arrange.sendBackward':
					onMoveLayer('backward');
					break;
				case 'home.arrange.bringForward':
					onMoveLayer('forward');
					break;
				case 'home.arrange.sendToBack':
					onMoveLayerToEdge('back');
					break;
				case 'home.arrange.bringToFront':
					onMoveLayerToEdge('front');
			}
		},
		[onMoveLayer, onMoveLayerToEdge],
	);
	const requestEdit = useCallback(
		(id: string) => (id === 'home.arrange.duplicate' ? onDuplicate() : onDelete()),
		[onDuplicate, onDelete],
	);

	return (
		<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.arrange')}>
			<div className='flex items-center gap-1' data-pptx-chrome='arrange-controls'>
				<WebHomeControls family='arrange-align' controls={controls} onRequest={requestAlign} />
				{p.onToggleFormatPainter && (
					<button
						type='button'
						onClick={p.onToggleFormatPainter}
						disabled={
							!p.canEdit || (p.canActivateFormatPainter === false && !p.formatPainterActive)
						}
						data-testid='format-painter-toggle'
						data-active={p.formatPainterActive ? 'true' : 'false'}
						className={cn(
							pill,
							p.formatPainterActive ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '',
						)}
						title={t('pptx.arrange.formatPainter')}
						{...controlAttr('home.clipboard.formatPainter')}
					>
						<LuPaintbrush className={ic} />
						{t('pptx.arrange.format')}
					</button>
				)}
				<WebHomeControls family='arrange-flip' controls={controls} onRequest={requestFlip} />
				<ShapeArrangeExtras
					canEdit={p.canEdit}
					selectedElement={p.selectedElement}
					selectedCount={p.selectedCount}
					selectionGroupable={p.selectionGroupable}
					onGroupElements={p.onGroupElements}
					onUngroupElement={p.onUngroupElement}
					onUpdateElementStyle={p.onUpdateElementStyle}
					hiddenActions={p.hiddenActions}
				/>
				<WebHomeControls family='arrange-order' controls={controls} onRequest={requestOrder} />
				<WebHomeControls family='arrange-edit' controls={controls} onRequest={requestEdit} />
			</div>
			<span className='text-[9px] text-muted-foreground leading-none'>
				{t('pptx.arrange.groupLabel')}
			</span>
		</div>
	);
}
