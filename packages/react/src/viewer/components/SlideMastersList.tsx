import type { PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import { masterViewPseudoSlide } from 'pptx-viewer-shared';
import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSize } from '../types';
import { cn } from '../utils';
import { SlideThumbnail } from './SlideThumbnail';

// ---------------------------------------------------------------------------
// Helpers: build pseudo PptxSlide for thumbnail rendering
// ---------------------------------------------------------------------------

/**
 * The rail's thumbnails are the same pseudo-slides the master canvas paints,
 * so they come from the shared rule rather than a fourth local copy of it: a
 * layout thumbnail shows the master's artwork behind its own.
 */
function partToSlide(master: PptxSlideMaster, layoutIndex: number | null): PptxSlide | undefined {
	return masterViewPseudoSlide(
		{ slideMasters: [master] },
		{ tab: 'slides', masterIndex: 0, layoutIndex },
	);
}

const EMPTY_SLIDE: PptxSlide = { id: '', rId: '', slideNumber: 0, elements: [] };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlideMastersListProps {
	slideMasters: PptxSlideMaster[];
	activeMasterIndex: number;
	activeLayoutIndex: number | null;
	canvasSize: CanvasSize;
	onSelectMaster: (index: number) => void;
	onSelectLayout: (masterIndex: number, layoutIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideMastersList({
	slideMasters,
	activeMasterIndex,
	activeLayoutIndex,
	canvasSize,
	onSelectMaster,
	onSelectLayout,
}: SlideMastersListProps): React.ReactElement {
	const activeRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}, [activeMasterIndex, activeLayoutIndex]);

	const { t } = useTranslation();

	return (
		<>
			{slideMasters.map((master, masterIdx) => {
				const isMasterActive = masterIdx === activeMasterIndex && activeLayoutIndex === null;
				const layouts = master.layouts ?? [];

				return (
					<div key={master.path} className='space-y-1'>
						{/*
						 * A real <button> with an accessible name, as vue, angular,
						 * svelte and vanilla all render here. React's rail was a bare
						 * `<div onClick>`: not reachable by keyboard, invisible to
						 * assistive technology, and nameless, so the only way to pick a
						 * master or layout was a mouse click on an unlabelled box.
						 */}
						<button
							type='button'
							ref={isMasterActive ? activeRef : undefined}
							aria-pressed={isMasterActive}
							aria-label={master.name || t('pptx.master.master')}
							className={cn(
								'group relative block w-full cursor-pointer rounded-lg border-2 p-1 text-left transition-all',
								isMasterActive
									? 'border-amber-500 bg-amber-500/10'
									: 'border-border bg-background/40 hover:border-border',
							)}
							onClick={() => onSelectMaster(masterIdx)}
						>
							<div className='relative overflow-hidden rounded bg-white'>
								<SlideThumbnail
									slide={partToSlide(master, null) ?? EMPTY_SLIDE}
									templateElements={[]}
									canvasSize={canvasSize}
								/>
							</div>
							<div className='mt-1 px-1'>
								<span
									className={cn(
										'text-[10px] font-medium',
										isMasterActive ? 'text-amber-400' : 'text-muted-foreground',
									)}
								>
									{master.name || t('pptx.master.master')}
								</span>
							</div>
						</button>

						{layouts.length > 0 && (
							<div className='ml-3 space-y-1 border-l border-border/40 pl-2'>
								{layouts.map((layout, layoutIdx) => {
									const isLayoutActive =
										masterIdx === activeMasterIndex && layoutIdx === activeLayoutIndex;

									return (
										<button
											type='button'
											key={layout.path}
											ref={isLayoutActive ? activeRef : undefined}
											aria-pressed={isLayoutActive}
											aria-label={layout.name || t('pptx.master.layout')}
											className={cn(
												'group relative block w-full cursor-pointer rounded-md border-2 p-0.5 text-left transition-all',
												isLayoutActive
													? 'border-primary bg-primary/10'
													: 'border-border bg-background/40 hover:border-border',
											)}
											onClick={() => onSelectLayout(masterIdx, layoutIdx)}
										>
											<div className='relative overflow-hidden rounded bg-white'>
												<SlideThumbnail
													slide={partToSlide(master, layoutIdx) ?? EMPTY_SLIDE}
													templateElements={[]}
													canvasSize={canvasSize}
												/>
											</div>
											<div className='mt-0.5 px-0.5'>
												<span
													className={cn(
														'text-[9px]',
														isLayoutActive ? 'text-primary' : 'text-muted-foreground',
													)}
												>
													{layout.name || t('pptx.master.layout')}
												</span>
											</div>
										</button>
									);
								})}
							</div>
						)}
					</div>
				);
			})}

			{slideMasters.length === 0 && (
				<div className='px-2 py-4 text-center text-xs text-muted-foreground'>
					{t('pptx.master.noMasters')}
				</div>
			)}
		</>
	);
}
