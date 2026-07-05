import type { PptxElement } from 'pptx-viewer-core';
import React, { useState, useRef, useEffect } from 'react';
import { LuLayers, LuPaintBucket, LuPenLine, LuShapes, LuSparkles } from 'react-icons/lu';

import { SHAPE_PRESETS } from '../../constants';
import type { SupportedShapeType } from '../../types-core';
import { cn } from '../../utils';
import { ic, pill, sep } from './toolbar-constants';

export interface DrawingGroupProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	newShapeType: SupportedShapeType;
	onSetNewShapeType: (type: SupportedShapeType) => void;
	onAddShape: () => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
	onUpdateElementStyle?: (style: Record<string, unknown>) => void;
}

const FILL_COLORS = [
	'#ffffff',
	'#000000',
	'#ff0000',
	'#00ff00',
	'#0000ff',
	'#ffff00',
	'#ff00ff',
	'#00ffff',
	'#ff8800',
	'#8800ff',
	'#008888',
	'#888888',
];

const TOP_SHAPES = SHAPE_PRESETS.slice(0, 12);

export function DrawingGroup(p: DrawingGroupProps): React.ReactElement {
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
							title='Shapes'
							onClick={() => setShapesOpen((v) => !v)}
						>
							<LuShapes className={ic} />
							Shapes
						</button>
						{shapesOpen && (
							<div className='absolute left-0 top-full z-50 flex flex-col w-52 pt-1'>
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
											{s.label}
										</button>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Arrange dropdown */}
					<div className='relative' ref={arrangeRef}>
						<button
							type='button'
							disabled={!p.canEdit || !p.selectedElement}
							className={pill}
							title='Arrange'
							onClick={() => setArrangeOpen((v) => !v)}
						>
							<LuLayers className={ic} />
							Arrange
						</button>
						{arrangeOpen && (
							<div className='absolute left-0 top-full z-50 flex flex-col w-44 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1'>
									<button
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
										onClick={() => {
											p.onMoveLayer('forward');
											setArrangeOpen(false);
										}}
									>
										Bring Forward
									</button>
									<button
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
										onClick={() => {
											p.onMoveLayer('backward');
											setArrangeOpen(false);
										}}
									>
										Send Backward
									</button>
									<button
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
										onClick={() => {
											p.onMoveLayerToEdge('front');
											setArrangeOpen(false);
										}}
									>
										Bring to Front
									</button>
									<button
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
										onClick={() => {
											p.onMoveLayerToEdge('back');
											setArrangeOpen(false);
										}}
									>
										Send to Back
									</button>
								</div>
							</div>
						)}
					</div>

					{/* Shape Fill */}
					<div className='relative' ref={fillRef}>
						<button
							type='button'
							disabled={!p.canEdit || !p.selectedElement}
							className={pill}
							title='Shape Fill'
							onClick={() => setFillOpen((v) => !v)}
						>
							<LuPaintBucket className={ic} />
						</button>
						{fillOpen && (
							<div className='absolute left-0 top-full z-50 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 grid grid-cols-6 gap-1'>
									{FILL_COLORS.map((c) => (
										<button
											key={c}
											type='button'
											aria-label={`Fill colour ${c}`}
											className='w-5 h-5 rounded border border-border/60 hover:scale-110 transition-transform'
											style={{ backgroundColor: c }}
											title={c}
											onClick={() => {
												p.onUpdateElementStyle?.({ fill: c });
												setFillOpen(false);
											}}
										/>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Shape Outline */}
					<div className='relative' ref={outlineRef}>
						<button
							type='button'
							disabled={!p.canEdit || !p.selectedElement}
							className={pill}
							title='Shape Outline'
							onClick={() => setOutlineOpen((v) => !v)}
						>
							<LuPenLine className={ic} />
						</button>
						{outlineOpen && (
							<div className='absolute left-0 top-full z-50 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 grid grid-cols-6 gap-1'>
									{FILL_COLORS.map((c) => (
										<button
											key={c}
											type='button'
											aria-label={`Outline colour ${c}`}
											className='w-5 h-5 rounded border border-border/60 hover:scale-110 transition-transform'
											style={{ backgroundColor: c }}
											title={c}
											onClick={() => {
												p.onUpdateElementStyle?.({ outlineColor: c });
												setOutlineOpen(false);
											}}
										/>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Shape Effects (placeholder) */}
					<button
						type='button'
						disabled
						className={cn(pill, 'opacity-50 cursor-not-allowed')}
						title='Shape Effects (not available)'
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
