import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { FIXED_TAB_GALLERIES, shapeFillChange, shapeOutlineChange } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuLayers,
	LuPaintBucket,
	LuPalette,
	LuPenLine,
	LuShapes,
	LuSparkles,
} from 'react-icons/lu';

import { SHAPE_PRESETS } from '../../constants';
import type { SupportedShapeType } from '../../types-core';
import { cn } from '../../utils';
import { useRecentColors } from '../inspector/RecentColorsContext';
import { controlAttr, groupAttr } from './PowerPointRibbonControls';
import { RibbonGallery } from './RibbonGallery';
import { RibbonMenu } from './RibbonMenu';
import { ShapeColorPopover } from './ShapeColorPopover';
import { ic, pill, sep } from './toolbar-constants';
import { useRibbonDropdown } from './useRibbonDropdown';

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
	const shapes = useRibbonDropdown();
	const arrange = useRibbonDropdown();
	const fill = useRibbonDropdown();
	const outline = useRibbonDropdown();
	const setShapesOpen = shapes.setOpen;
	const setArrangeOpen = arrange.setOpen;

	return (
		<>
			<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.drawing')}>
				<div className='flex items-center gap-1'>
					{/* Shapes dropdown */}
					<div className='relative' ref={shapes.ref} {...controlAttr('home.drawing.shapes')}>
						<button
							type='button'
							disabled={!p.canEdit}
							className={pill}
							title={t('pptx.drawing.shapes')}
							onClick={() => setShapesOpen((v) => !v)}
						>
							<LuShapes className={ic} />
							{t('pptx.drawing.shapes')}
						</button>
						{shapes.open && (
							<RibbonMenu anchorRef={shapes.ref} className='flex flex-col w-52 pt-1'>
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
							</RibbonMenu>
						)}
					</div>

					{/* Arrange dropdown */}
					<div className='relative' ref={arrange.ref} {...controlAttr('home.drawing.arrange')}>
						<button
							type='button'
							disabled={!p.canEdit || !p.selectedElement}
							className={pill}
							title={t('pptx.ribbon.arrange')}
							onClick={() => setArrangeOpen((v) => !v)}
						>
							<LuLayers className={ic} />
							{t('pptx.ribbon.arrange')}
						</button>
						{arrange.open && (
							<RibbonMenu anchorRef={arrange.ref} className='flex flex-col w-44 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1'>
									<button
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
										onClick={() => {
											p.onMoveLayer('forward');
											setArrangeOpen(false);
										}}
									>
										{t('pptx.contextMenu.bringForward')}
									</button>
									<button
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
										onClick={() => {
											p.onMoveLayer('backward');
											setArrangeOpen(false);
										}}
									>
										{t('pptx.contextMenu.sendBackward')}
									</button>
									<button
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
										onClick={() => {
											p.onMoveLayerToEdge('front');
											setArrangeOpen(false);
										}}
									>
										{t('pptx.contextMenu.bringToFront')}
									</button>
									<button
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
										onClick={() => {
											p.onMoveLayerToEdge('back');
											setArrangeOpen(false);
										}}
									>
										{t('pptx.contextMenu.sendToBack')}
									</button>
								</div>
							</RibbonMenu>
						)}
					</div>

					{/* Shape Fill */}
					<ShapeColorPopover
						icon={<LuPaintBucket className={ic} />}
						title={t('pptx.drawing.shapeFill')}
						prefix='shape-fill'
						anchorRef={fill.ref}
						open={fill.open}
						onToggle={() => fill.setOpen((v) => !v)}
						controlId='home.drawing.shapeFill'
						disabled={!p.canEdit || !p.selectedElement}
						swatchAriaLabel='Fill colour'
						selectedRef={selectedShapeStyle?.fillColorRef}
						selectedHex={selectedShapeStyle?.fillColor}
						onApply={(c, ref) => {
							p.onUpdateElementStyle?.(shapeFillChange(c, ref));
							pushColor(c);
						}}
						onClose={() => fill.setOpen(false)}
					/>

					{/* Shape Outline */}
					<ShapeColorPopover
						icon={<LuPenLine className={ic} />}
						title={t('pptx.drawing.shapeOutline')}
						prefix='shape-outline'
						anchorRef={outline.ref}
						open={outline.open}
						onToggle={() => outline.setOpen((v) => !v)}
						controlId='home.drawing.shapeOutline'
						disabled={!p.canEdit || !p.selectedElement}
						swatchAriaLabel='Outline colour'
						selectedRef={selectedShapeStyle?.strokeColorRef}
						selectedHex={selectedShapeStyle?.strokeColor}
						onApply={(c, ref) => {
							p.onUpdateElementStyle?.(shapeOutlineChange(c, ref));
							pushColor(c);
						}}
						onClose={() => outline.setOpen(false)}
					/>

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
