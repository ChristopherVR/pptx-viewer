import type { PptxHeaderFooter } from 'pptx-viewer-core';
import {
	isHeaderFooterDateTextVisible,
	isHeaderFooterHeaderTextVisible,
	isHeaderFooterFooterTextVisible,
} from 'pptx-viewer-shared';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCalendarDays, LuCheck, LuClock, LuFileText, LuHash, LuText, LuX } from 'react-icons/lu';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HeaderFooterPanelProps {
	headerFooter: PptxHeaderFooter;
	onUpdate: (patch: Partial<PptxHeaderFooter>) => void;
	onApplyToAll: () => void;
	onApplyToCurrent: () => void;
	onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface ToggleRowProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	icon: React.ReactNode;
	label: string;
	testId?: string;
}

function ToggleRow({ checked, onChange, icon, label, testId }: ToggleRowProps): React.ReactElement {
	return (
		<label className='flex items-center gap-2.5 cursor-pointer group select-none'>
			<span className='relative flex items-center justify-center w-4 h-4'>
				<input
					type='checkbox'
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
					data-testid={testId}
					className='peer sr-only'
				/>
				<span className='absolute inset-0 rounded border border-border bg-muted transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50' />
				{checked && <LuCheck className='relative z-10 w-3 h-3 text-white' />}
			</span>
			<span className='flex items-center gap-1.5 text-xs text-foreground group-hover:text-foreground transition-colors'>
				{icon}
				{label}
			</span>
		</label>
	);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Header & Footer dialog. Covers the same `PptxHeaderFooter` fields Vue and
 * Angular's ports cover (this used to be React-only booleans for date/time,
 * slide number and footer with no header field and no auto/fixed date
 * distinction; Vue/Angular's ports already carried both).
 */
export function HeaderFooterPanel({
	headerFooter,
	onUpdate,
	onApplyToAll,
	onApplyToCurrent,
	onClose,
}: HeaderFooterPanelProps): React.ReactElement {
	const { t } = useTranslation();

	const showDateTime = headerFooter.hasDateTime ?? false;
	const dateTimeAuto = headerFooter.dateTimeAuto ?? false;
	const showDateText = isHeaderFooterDateTextVisible(headerFooter);
	const showSlideNumber = headerFooter.hasSlideNumber ?? false;
	const showHeader = headerFooter.hasHeader ?? false;
	const showHeaderText = isHeaderFooterHeaderTextVisible(headerFooter);
	const showFooter = headerFooter.hasFooter ?? false;
	const showFooterText = isHeaderFooterFooterTextVisible(headerFooter);

	const handleDateTextChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ dateTimeText: e.target.value }),
		[onUpdate],
	);
	const handleHeaderTextChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ headerText: e.target.value }),
		[onUpdate],
	);
	const handleFooterTextChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ footerText: e.target.value }),
		[onUpdate],
	);

	return (
		<div className='absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm'>
			<div className='w-full max-w-sm rounded-lg border border-border bg-background shadow-2xl'>
				{/* ── Header ── */}
				<div className='flex items-center justify-between border-b border-border px-4 py-3'>
					<h2 className='text-sm font-semibold text-foreground'>{t('pptx.headerFooter.title')}</h2>
					<button
						type='button'
						onClick={onClose}
						className='rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
						aria-label={t('pptx.headerFooter.close')}
						data-testid='header-footer-close'
					>
						<LuX className='w-4 h-4' />
					</button>
				</div>

				{/* ── Body ── */}
				<div className='space-y-4 px-4 py-4'>
					{/* Toggle: Date/Time */}
					<ToggleRow
						checked={showDateTime}
						onChange={(hasDateTime) => onUpdate({ hasDateTime })}
						icon={<LuCalendarDays className='w-3.5 h-3.5' />}
						label={t('pptx.headerFooter.dateAndTime')}
						testId='hf-date-time'
					/>

					{showDateTime && (
						<div className='pl-6 space-y-2'>
							<ToggleRow
								checked={dateTimeAuto}
								onChange={(auto) => onUpdate({ dateTimeAuto: auto })}
								icon={<LuClock className='w-3.5 h-3.5' />}
								label={t('pptx.headerFooter.updateAutomatically')}
								testId='hf-date-auto'
							/>
							{showDateText && (
								<input
									type='text'
									value={headerFooter.dateTimeText ?? ''}
									onChange={handleDateTextChange}
									placeholder={t('pptx.headerFooter.fixedDate')}
									data-testid='hf-date-text'
									className='w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30'
								/>
							)}
						</div>
					)}

					{/* Toggle: Slide number */}
					<ToggleRow
						checked={showSlideNumber}
						onChange={(hasSlideNumber) => onUpdate({ hasSlideNumber })}
						icon={<LuHash className='w-3.5 h-3.5' />}
						label={t('pptx.headerFooter.slideNumber')}
						testId='hf-slide-number'
					/>

					{/* Toggle: Header */}
					<ToggleRow
						checked={showHeader}
						onChange={(hasHeader) => onUpdate({ hasHeader })}
						icon={<LuFileText className='w-3.5 h-3.5' />}
						label={t('pptx.field.header')}
						testId='hf-header'
					/>

					{showHeaderText && (
						<div className='pl-6'>
							<input
								type='text'
								value={headerFooter.headerText ?? ''}
								onChange={handleHeaderTextChange}
								placeholder={t('pptx.headerFooter.headerText')}
								data-testid='hf-header-text'
								className='w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30'
							/>
						</div>
					)}

					{/* Toggle: Footer */}
					<ToggleRow
						checked={showFooter}
						onChange={(hasFooter) => onUpdate({ hasFooter })}
						icon={<LuText className='w-3.5 h-3.5' />}
						label={t('pptx.headerFooter.footer')}
						testId='hf-footer'
					/>

					{/* Footer text input: only visible when footer is enabled */}
					{showFooterText && (
						<div className='pl-6'>
							<input
								type='text'
								value={headerFooter.footerText ?? ''}
								onChange={handleFooterTextChange}
								placeholder={t('pptx.headerFooter.footerPlaceholder')}
								data-testid='hf-footer-text'
								className='w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30'
							/>
						</div>
					)}
				</div>

				{/* ── Footer actions ── */}
				<div className='flex items-center justify-end gap-2 border-t border-border px-4 py-3'>
					<button
						type='button'
						onClick={onApplyToAll}
						data-testid='hf-apply-all'
						className='rounded bg-accent px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/80 transition-colors'
					>
						{t('pptx.headerFooter.applyToAll')}
					</button>
					<button
						type='button'
						onClick={onApplyToCurrent}
						data-testid='hf-apply-current'
						className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/80 transition-colors'
					>
						{t('pptx.headerFooter.applyToCurrent')}
					</button>
				</div>
			</div>
		</div>
	);
}
