import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { shapeFillChange, shapeOutlineChange } from 'pptx-viewer-shared';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuLayers, LuPaintBucket, LuPenLine, LuShapes, LuSparkles } from 'react-icons/lu';

import { SHAPE_PRESETS } from '../../constants';
import type { SupportedShapeType } from '../../types-core';
import { cn } from '../../utils';
import { useRecentColors } from '../inspector/RecentColorsContext';
import { RibbonMenu } from './RibbonMenu';
import { ShapeColorPopover } from './ShapeColorPopover';
import { ic, pill, sep } from './toolbar-constants';

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

export function DrawingGroup(p: DrawingGroupProps): React.ReactElement {
	const { t } = useTranslation();
	const { pushColor } = useRecentColors();
	const [shapesOpen, setShapesOpen] = useState(false);
	const [arrangeOpen, setArrangeOpen] = useState(false);
	const [fillOpen, setFillOpen] = useState(false);
	const [outlineOpen, setOutlineOpen] = useState(false);
	const shapesRef = useRef<HTMLDivElement>(null);
	const arrangeRef = useRef<HTMLDivElement>(null);
	const fillRef = useRef<HTMLDivElement>(null);
	const outlineRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!shapesOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (shapesRef.current && !shapesRef.current.contains(e.target as Node)) {
				setShapesOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [shapesOpen]);

	useEffect(() => {
		if (!arrangeOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (arrangeRef.current && !arrangeRef.current.contains(e.target as Node)) {
				setArrangeOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [arrangeOpen]);

	useEffect(() => {
		if (!fillOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (fillRef.current && !fillRef.current.contains(e.target as Node)) {
				setFillOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [fillOpen]);

	useEffect(() => {
		if (!outlineOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (outlineRef.current && !outlineRef.current.contains(e.target as Node)) {
				setOutlineOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [outlineOpen]);

	return (
		<>
			<div className='flex flex-col items-center gap-0.5'>
				<div className='flex items-center gap-1'>
					{/* Shapes dropdown */}
					<div className='relative' ref={shapesRef}>
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
						{shapesOpen && (
							<RibbonMenu anchorRef={shapesRef} className='flex flex-col w-52 pt-1'>
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
					<div className='relative' ref={arrangeRef}>
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
						{arrangeOpen && (
							<RibbonMenu anchorRef={arrangeRef} className='flex flex-col w-44 pt-1'>
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
						anchorRef={fillRef}
						open={fillOpen}
						onToggle={() => setFillOpen((v) => !v)}
						disabled={!p.canEdit || !p.selectedElement}
						swatchAriaLabel='Fill colour'
						onApply={(c) => {
							p.onUpdateElementStyle?.(shapeFillChange(c));
							pushColor(c);
						}}
						onClose={() => setFillOpen(false)}
					/>

					{/* Shape Outline */}
					<ShapeColorPopover
						icon={<LuPenLine className={ic} />}
						title={t('pptx.drawing.shapeOutline')}
						prefix='shape-outline'
						anchorRef={outlineRef}
						open={outlineOpen}
						onToggle={() => setOutlineOpen((v) => !v)}
						disabled={!p.canEdit || !p.selectedElement}
						swatchAriaLabel='Outline colour'
						onApply={(c) => {
							p.onUpdateElementStyle?.(shapeOutlineChange(c));
							pushColor(c);
						}}
						onClose={() => setOutlineOpen(false)}
					/>

					{/* Shape Effects (placeholder) */}
					<button
						type='button'
						disabled
						className={pill}
						title={t('pptx.drawing.shapeEffectsUnavailable')}
					>
						<LuSparkles className={ic} />
					</button>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>Drawing</span>
			</div>

			{sep}
		</>
	);
}
