import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuFolderPlus, LuPlus, LuRotateCcw, LuLayoutGrid } from 'react-icons/lu';

import { cn } from '../../utils';
import { RibbonMenu } from './RibbonMenu';
import { ic, pill, sep } from './toolbar-constants';

export interface SlidesGroupProps {
	canEdit: boolean;
	layoutOptions: Array<{ path: string; name: string }>;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
}

export function SlidesGroup(p: SlidesGroupProps): React.ReactElement {
	const { t } = useTranslation();
	const [newSlideMenuOpen, setNewSlideMenuOpen] = useState(false);
	const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
	const newSlideMenuRef = useRef<HTMLDivElement>(null);
	const layoutMenuRef = useRef<HTMLDivElement>(null);

	const handleNewSlide = useCallback(() => {
		if (p.layoutOptions.length > 0) {
			const first = p.layoutOptions[0];
			p.onInsertSlideFromLayout(first.path, first.name);
		}
	}, [p]);

	useEffect(() => {
		if (!newSlideMenuOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (newSlideMenuRef.current && !newSlideMenuRef.current.contains(e.target as Node)) {
				setNewSlideMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [newSlideMenuOpen]);

	useEffect(() => {
		if (!layoutMenuOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
				setLayoutMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [layoutMenuOpen]);

	return (
		<>
			<div className='flex flex-col items-center gap-0.5'>
				<div className='flex items-center gap-1'>
					{/* New Slide split button */}
					<div className='relative inline-flex items-center' ref={newSlideMenuRef}>
						<button
							type='button'
							onClick={handleNewSlide}
							disabled={!p.canEdit || p.layoutOptions.length === 0}
							className={cn(
								pill,
								'whitespace-nowrap',
								p.layoutOptions.length > 0 ? 'rounded-r-none' : '',
							)}
							title={t('pptx.home.newSlide')}
						>
							<LuPlus className={ic} />
							{t('pptx.home.newSlide')}
						</button>
						{p.layoutOptions.length > 0 && (
							<button
								type='button'
								disabled={!p.canEdit}
								className='inline-flex items-center justify-center self-stretch px-1 rounded-r bg-muted hover:bg-accent text-xs transition-colors border-l border-border/40 active:scale-95 active:opacity-80'
								title={t('pptx.home.chooseLayout')}
								onClick={() => setNewSlideMenuOpen((v) => !v)}
							>
								<LuChevronDown className='w-3 h-3' />
							</button>
						)}
						{newSlideMenuOpen && (
							<RibbonMenu anchorRef={newSlideMenuRef} className='flex flex-col w-48 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 max-h-60 overflow-y-auto'>
									{p.layoutOptions.map((lo) => (
										<button
											key={lo.path}
											type='button'
											className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
											onClick={() => {
												p.onInsertSlideFromLayout(lo.path, lo.name);
												setNewSlideMenuOpen(false);
											}}
										>
											{lo.name}
										</button>
									))}
								</div>
							</RibbonMenu>
						)}
					</div>

					{/* Layout button */}
					<div className='relative inline-flex items-center' ref={layoutMenuRef}>
						<button
							type='button'
							disabled={!p.canEdit || p.layoutOptions.length === 0}
							className={pill}
							title={t('pptx.master.layout')}
							onClick={() => setLayoutMenuOpen((v) => !v)}
						>
							<LuLayoutGrid className={ic} />
							{t('pptx.master.layout')}
						</button>
						{layoutMenuOpen && (
							<RibbonMenu anchorRef={layoutMenuRef} className='flex flex-col w-48 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 max-h-60 overflow-y-auto'>
									{p.layoutOptions.map((lo) => (
										<button
											key={lo.path}
											type='button'
											className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
											onClick={() => {
												p.onApplyLayout?.(lo.path);
												setLayoutMenuOpen(false);
											}}
										>
											{lo.name}
										</button>
									))}
								</div>
							</RibbonMenu>
						)}
					</div>

					{/* Reset button */}
					<button
						type='button'
						disabled={!p.canEdit}
						className={pill}
						title={t('pptx.sections.resetSlideTitle')}
						onClick={p.onResetSlide}
					>
						<LuRotateCcw className={ic} />
						{t('pptx.animations.reset')}
					</button>

					{/* Section button */}
					<button
						type='button'
						disabled={!p.canEdit}
						className={pill}
						title={t('pptx.sections.addSection')}
						onClick={p.onAddSection}
					>
						<LuFolderPlus className={ic} />
						{t('pptx.sections.sectionButtonLabel')}
					</button>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>Slides</span>
			</div>

			{sep}
		</>
	);
}
