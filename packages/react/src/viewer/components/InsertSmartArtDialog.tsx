import type { SmartArtLayout } from 'pptx-viewer-core';
import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';

import { useModalDismissDrag } from '../hooks';
import { useModalFocus } from '../hooks/useModalFocus';
import { cn } from '../utils';
import type { SmartArtCategory } from './smart-art-presets';
import { PRESETS, CATEGORIES } from './smart-art-presets';
import { getPreviewForLayout } from './SmartArtPreviews';

// ── Dialog Component ────────────────────────────────────────────────────────

export interface InsertSmartArtDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onInsert: (layout: SmartArtLayout, defaultItems: string[]) => void;
}

export function InsertSmartArtDialog({
	isOpen,
	onClose,
	onInsert,
}: InsertSmartArtDialogProps): React.ReactElement | null {
	const { t } = useTranslation();
	const { panelStyle, handlers: dragHandlers } = useModalDismissDrag(onClose);
	const [activeCategory, setActiveCategory] = useState<SmartArtCategory>('list');
	const [selectedLayout, setSelectedLayout] = useState<SmartArtLayout | null>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	useModalFocus(isOpen, dialogRef, onClose);

	const filteredPresets = PRESETS.filter((p) => p.category === activeCategory);

	const handleInsert = useCallback(() => {
		if (!selectedLayout) {
			return;
		}
		const preset = PRESETS.find((p) => p.layout === selectedLayout);
		if (!preset) {
			return;
		}
		onInsert(preset.layout, preset.defaultItems);
		onClose();
	}, [selectedLayout, onInsert, onClose]);

	if (!isOpen) {
		return null;
	}

	return (
		<>
			{/* Backdrop */}
			<button
				type='button'
				style={{ zIndex: 1200 }}
				className='fixed inset-0 bg-black/50'
				onClick={onClose}
				aria-label={t('pptx.smartart.close')}
			/>

			{/* Dialog */}
			<div
				style={{ zIndex: 1201 }}
				className='fixed inset-0 flex items-center justify-center pointer-events-none'
			>
				<div
					ref={dialogRef}
					style={panelStyle}
					className='pointer-events-auto w-[600px] max-w-[90vw] max-h-[80vh] rounded-lg border border-border bg-background shadow-2xl flex flex-col max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:max-h-[88dvh] max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]'
					role='dialog'
					aria-modal='true'
					aria-label={t('pptx.smartart.insertTitle')}
					tabIndex={-1}
				>
					{/* Header — also a swipe-down-to-dismiss grab region on touch. */}
					<div
						{...dragHandlers}
						className='flex items-center justify-between px-4 py-3 border-b border-border touch-none'
					>
						<h2 className='text-sm font-medium text-foreground'>
							{t('pptx.smartart.insertTitle')}
						</h2>
						<button
							type='button'
							onClick={onClose}
							className='p-1 rounded hover:bg-muted transition-colors'
							aria-label={t('pptx.smartart.close')}
						>
							<LuX className='w-4 h-4' />
						</button>
					</div>

					{/* Body */}
					<div className='flex flex-1 overflow-hidden'>
						{/* Category sidebar */}
						<nav
							className='w-40 border-r border-border py-2'
							aria-label={t('pptx.insertSmartArt.categories')}
						>
							{CATEGORIES.map((cat) => (
								<button
									key={cat.id}
									type='button'
									onClick={() => {
										setActiveCategory(cat.id);
										setSelectedLayout(null);
									}}
									className={cn(
										'w-full text-left px-3 py-1.5 text-xs transition-colors',
										activeCategory === cat.id
											? 'bg-primary text-white'
											: 'text-foreground hover:bg-muted',
									)}
								>
									{t(cat.label)}
								</button>
							))}
						</nav>

						{/* Gallery grid */}
						<div className='flex-1 p-3 overflow-y-auto'>
							<div
								className='grid grid-cols-3 gap-2'
								role='listbox'
								aria-label={t('pptx.insertSmartArt.layouts')}
							>
								{filteredPresets.map((preset) => (
									<button
										key={preset.layout}
										type='button'
										role='option'
										aria-selected={selectedLayout === preset.layout}
										onClick={() => setSelectedLayout(preset.layout)}
										onDoubleClick={() => {
											setSelectedLayout(preset.layout);
											onInsert(preset.layout, preset.defaultItems);
											onClose();
										}}
										className={cn(
											'flex flex-col items-center gap-1 p-2 rounded border transition-colors',
											selectedLayout === preset.layout
												? 'border-primary bg-primary/20'
												: 'border-border hover:border-border hover:bg-muted/50',
										)}
									>
										<div className='w-16 h-12 flex items-center justify-center bg-muted rounded'>
											{getPreviewForLayout(preset.layout)}
										</div>
										<span className='text-[10px] text-foreground text-center leading-tight'>
											{t(preset.labelKey)}
										</span>
									</button>
								))}
							</div>
						</div>
					</div>

					{/* Footer */}
					<div className='flex items-center justify-end gap-2 px-4 py-3 border-t border-border'>
						<button
							type='button'
							onClick={onClose}
							className='px-3 py-1.5 text-xs rounded bg-muted hover:bg-accent text-foreground transition-colors'
						>
							{t('pptx.smartart.cancel')}
						</button>
						<button
							type='button'
							onClick={handleInsert}
							disabled={!selectedLayout}
							className={cn(
								'px-3 py-1.5 text-xs rounded transition-colors',
								selectedLayout
									? 'bg-primary hover:bg-primary/80 text-white'
									: 'bg-muted text-muted-foreground cursor-not-allowed',
							)}
						>
							{t('pptx.smartart.insert')}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
