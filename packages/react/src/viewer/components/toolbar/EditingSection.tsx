import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMousePointer2, LuReplace, LuSearch } from 'react-icons/lu';

import { RibbonMenu } from './RibbonMenu';
import { gB, gL, grp, ic, pill, sep } from './toolbar-constants';

export interface EditingSectionProps {
	onToggleFindReplace: () => void;
	onSelectAll?: () => void;
}

export function EditingSection(p: EditingSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const [selectMenuOpen, setSelectMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!selectMenuOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setSelectMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [selectMenuOpen]);

	return (
		<>
			{sep}

			<div className='flex flex-col items-center gap-0.5'>
				<div className='flex items-center gap-1'>
					{/* Find & Replace */}
					<div className={grp}>
						<button
							type='button'
							onMouseDown={(e) => e.preventDefault()}
							onClick={p.onToggleFindReplace}
							className={gB}
							title={t('pptx.editing.find')}
						>
							<LuSearch className={ic} />
						</button>
						<button
							type='button'
							onMouseDown={(e) => e.preventDefault()}
							onClick={p.onToggleFindReplace}
							className={gL}
							title={t('pptx.ribbon.replace')}
						>
							<LuReplace className={ic} />
						</button>
					</div>

					{/* Select dropdown */}
					<div className='relative' ref={menuRef}>
						<button
							type='button'
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => setSelectMenuOpen((v) => !v)}
							className={pill}
							title={t('pptx.ribbon.tool.select')}
						>
							<LuMousePointer2 className={ic} />
						</button>
						{selectMenuOpen && (
							<RibbonMenu anchorRef={menuRef} className='pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 w-32'>
									<button
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors'
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => {
											p.onSelectAll?.();
											setSelectMenuOpen(false);
										}}
									>
										{t('pptx.editing.selectAll')}
									</button>
								</div>
							</RibbonMenu>
						)}
					</div>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>Editing</span>
			</div>
		</>
	);
}
