import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import {
	FIXED_TAB_GALLERIES,
	drawingHomeControls,
	shapeFillChange,
	shapeOutlineChange,
} from 'pptx-viewer-shared';
import type { PptxUiRibbonHomeElement } from 'pptx-viewer-shared';
import React, { useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { LuPalette, LuSparkles } from 'react-icons/lu';

import { SHAPE_PRESETS } from '../../constants';
import type { SupportedShapeType } from '../../types-core';
import { cn } from '../../utils';
import { useRecentColors } from '../inspector/RecentColorsContext';
import { groupAttr } from './PowerPointRibbonControls';
import { RibbonGallery } from './RibbonGallery';
import { RibbonMenu } from './RibbonMenu';
import { ShapeColorPopover } from './ShapeColorPopover';
import { ic, sep } from './toolbar-constants';
import { useHomeAnchor, useHomePopover, WebHomeControls } from './WebHomeControls';

export interface DrawingGroupProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	newShapeType: SupportedShapeType;
	onSetNewShapeType: (type: SupportedShapeType) => void;
	onAddShape: () => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
	/**
	 * Patch the selected shape's style. Optional only because the mobile menu
	 * sheet renders the group without one; the desktop ribbon always passes it.
	 * It used to be passed by nobody, so both swatch grids were decorative.
	 */
	onUpdateElementStyle?: (style: Partial<ShapeStyle>) => void;
}

const TOP_SHAPES = SHAPE_PRESETS.slice(0, 12);

/** Home > Drawing's galleries, in ribbon order (Quick Styles, Shape Effects). */
const HOME_DRAWING_GALLERIES = FIXED_TAB_GALLERIES.filter((placement) =>
	placement.control.startsWith('home.drawing.'),
);

export function DrawingGroup(p: DrawingGroupProps): React.ReactElement {
	const { t } = useTranslation();
	const { pushColor } = useRecentColors();
	const selectedShapeStyle: ShapeStyle | undefined =
		p.selectedElement && hasShapeProperties(p.selectedElement)
			? p.selectedElement.shapeStyle
			: undefined;
	const elementRef = useRef<PptxUiRibbonHomeElement | null>(null);
	const shapes = useHomePopover(useHomeAnchor(elementRef, 'home.drawing.shapes'));
	const arrange = useHomePopover(useHomeAnchor(elementRef, 'home.drawing.arrange'));
	const fill = useHomePopover(useHomeAnchor(elementRef, 'home.drawing.shapeFill'));
	const outline = useHomePopover(useHomeAnchor(elementRef, 'home.drawing.shapeOutline'));
	const setShapesOpen = shapes.setOpen;
	const setArrangeOpen = arrange.setOpen;
	const setFillOpen = fill.setOpen;
	const setOutlineOpen = outline.setOpen;
	const { onMoveLayer, onMoveLayerToEdge } = p;

	const controls = useMemo(
		() =>
			drawingHomeControls({
				editable: p.canEdit,
				hasSelection: Boolean(p.selectedElement),
				open: {
					shapes: shapes.open,
					arrange: arrange.open,
					fill: fill.open,
					outline: outline.open,
				},
			}),
		[p.canEdit, p.selectedElement, shapes.open, arrange.open, fill.open, outline.open],
	);
	const request = useCallback(
		(id: string) => {
			switch (id) {
				case 'home.drawing.shapes':
					setShapesOpen((v) => !v);
					break;
				case 'home.drawing.arrange':
					setArrangeOpen((v) => !v);
					break;
				case 'home.drawing.shapeFill':
					setFillOpen((v) => !v);
					break;
				case 'home.drawing.shapeOutline':
					setOutlineOpen((v) => !v);
			}
		},
		[setShapesOpen, setArrangeOpen, setFillOpen, setOutlineOpen],
	);
	const arrangeItems: Array<[string, () => void]> = [
		['pptx.contextMenu.bringForward', () => onMoveLayer('forward')],
		['pptx.contextMenu.sendBackward', () => onMoveLayer('backward')],
		['pptx.contextMenu.bringToFront', () => onMoveLayerToEdge('front')],
		['pptx.contextMenu.sendToBack', () => onMoveLayerToEdge('back')],
	];
	const noTarget = !p.canEdit || !p.selectedElement;

	return (
		<>
			<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.drawing')}>
				<div className='flex items-center gap-1' data-pptx-chrome='drawing-controls'>
					<WebHomeControls
						family='drawing'
						controls={controls}
						onRequest={request}
						elementRef={elementRef}
					/>
					{shapes.open &&
						shapes.anchorRef.current &&
						createPortal(
							<RibbonMenu anchorRef={shapes.anchorRef} className='flex flex-col w-52 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 max-h-60 overflow-y-auto'>
									{TOP_SHAPES.map((s) => (
										<button
											key={s.type}
											type='button'
											className={cn(
												'flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors',
												p.newShapeType === s.type && 'bg-accent',
											)}
											onClick={() => {
												p.onSetNewShapeType(s.type);
												p.onAddShape();
												setShapesOpen(false);
											}}
										>
											{s.icon}
											{t(s.i18nKey)}
										</button>
									))}
								</div>
							</RibbonMenu>,
							shapes.anchorRef.current,
						)}
					{arrange.open &&
						arrange.anchorRef.current &&
						createPortal(
							<RibbonMenu anchorRef={arrange.anchorRef} className='flex flex-col w-44 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1'>
									{arrangeItems.map(([key, run]) => (
										<button
											key={key}
											type='button'
											className='flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
											onClick={() => {
												run();
												setArrangeOpen(false);
											}}
										>
											{t(key)}
										</button>
									))}
								</div>
							</RibbonMenu>,
							arrange.anchorRef.current,
						)}
					{fill.open &&
						fill.anchorRef.current &&
						createPortal(
							<ShapeColorPopover
								prefix='shape-fill'
								anchorRef={fill.anchorRef}
								disabled={noTarget}
								swatchAriaLabel='Fill colour'
								selectedRef={selectedShapeStyle?.fillColorRef}
								selectedHex={selectedShapeStyle?.fillColor}
								onApply={(c, ref) => {
									p.onUpdateElementStyle?.(shapeFillChange(c, ref));
									pushColor(c);
								}}
								onClose={() => setFillOpen(false)}
							/>,
							fill.anchorRef.current,
						)}
					{outline.open &&
						outline.anchorRef.current &&
						createPortal(
							<ShapeColorPopover
								prefix='shape-outline'
								anchorRef={outline.anchorRef}
								disabled={noTarget}
								swatchAriaLabel='Outline colour'
								selectedRef={selectedShapeStyle?.strokeColorRef}
								selectedHex={selectedShapeStyle?.strokeColor}
								onApply={(c, ref) => {
									p.onUpdateElementStyle?.(shapeOutlineChange(c, ref));
									pushColor(c);
								}}
								onClose={() => setOutlineOpen(false)}
							/>,
							outline.anchorRef.current,
						)}

					{/* Quick Styles + Shape Effects: shared galleries (FIXED_TAB_GALLERIES) */}
					{HOME_DRAWING_GALLERIES.map((placement) => (
						<RibbonGallery
							key={placement.control}
							placement={placement}
							icon={
								placement.gallery === 'shapeEffects' ? (
									<LuSparkles className={ic} />
								) : (
									<LuPalette className={ic} />
								)
							}
						/>
					))}
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.ribbon.groupDrawing')}
				</span>
			</div>

			{sep}
		</>
	);
}
