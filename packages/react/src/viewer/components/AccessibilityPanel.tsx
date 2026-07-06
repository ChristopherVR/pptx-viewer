import React from 'react';
import { useTranslation } from 'react-i18next';

import type { AccessibilityIssue } from '../types';
import { cn } from '../utils';

/**
 * Props for the {@link AccessibilityPanel} component.
 */
interface AccessibilityPanelProps {
	/** Whether the panel is visible. */
	isOpen: boolean;
	/** List of accessibility issues detected in the presentation. */
	issues: AccessibilityIssue[];
	/** Callback invoked when the user closes the panel. */
	onClose: () => void;
	/** Whether reduced motion mode is currently active. */
	reducedMotion?: boolean;
	/** Callback invoked when the user toggles reduced motion. */
	onToggleReducedMotion?: () => void;
}

/**
 * Floating panel that displays accessibility checker results and
 * provides a toggle for reduced motion mode.
 *
 * Each issue is rendered with a severity-based colour indicator
 * (error = red dot, warning = amber triangle, info = info icon).
 * When there are no issues, a success message is shown instead.
 *
 * @param props - {@link AccessibilityPanelProps}
 * @returns The rendered panel, or `null` when `isOpen` is `false`.
 */
export function AccessibilityPanel({
	isOpen,
	issues,
	onClose,
	reducedMotion,
	onToggleReducedMotion,
}: AccessibilityPanelProps): React.ReactElement | null {
	const { t } = useTranslation();

	if (!isOpen) {
		return null;
	}

	return (
		<div
			role='dialog'
			aria-label={t('pptx.accessibility.title')}
			className='absolute top-14 right-3 z-40 w-[min(28rem,calc(100%-1.5rem))] rounded border border-border bg-popover shadow-2xl'
		>
			{/* Panel header with issue count and close button */}
			<div className='flex items-center justify-between border-b border-border px-3 py-2'>
				<span className='text-xs uppercase tracking-wide text-foreground'>
					{t('pptx.accessibility.title')}
				</span>
				<div className='flex items-center gap-2'>
					<span className='text-[10px] text-muted-foreground'>
						{t('pptx.accessibility.issueCount', { count: issues.length })}
					</span>
					<button
						type='button'
						onClick={onClose}
						aria-label={t('pptx.accessibility.closePanel')}
						className='rounded px-2 py-1 text-[11px] text-foreground hover:bg-muted hover:text-foreground'
					>
						{t('pptx.accessibility.close')}
					</button>
				</div>
			</div>

			{/* Reduced motion toggle */}
			{onToggleReducedMotion !== undefined && (
				<div className='flex items-center justify-between border-b border-border px-3 py-2'>
					<label htmlFor='reduced-motion-toggle' className='text-xs text-foreground'>
						{t('pptx.accessibility.reduceMotion')}
					</label>
					<button
						id='reduced-motion-toggle'
						type='button'
						role='switch'
						aria-label={t('pptx.accessibility.reduceMotion')}
						aria-checked={reducedMotion ?? false}
						onClick={onToggleReducedMotion}
						className={cn(
							'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
							reducedMotion ? 'bg-primary' : 'bg-muted-foreground/30',
						)}
					>
						<span
							className={cn(
								'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
								reducedMotion ? 'translate-x-4' : 'translate-x-0.5',
							)}
						/>
					</button>
				</div>
			)}

			{/* Scrollable issue list */}
			<div
				role='list'
				aria-label={t('pptx.accessibility.issuesList')}
				className='max-h-72 overflow-y-auto p-2 space-y-1'
			>
				{issues.length === 0 ? (
					<div role='listitem' className='text-center text-xs text-muted-foreground py-4'>
						{t('pptx.accessibility.noIssues')}
					</div>
				) : (
					issues.map((issue, idx) => (
						<div
							key={idx}
							role='listitem'
							className={cn(
								'flex items-start gap-2 rounded px-2 py-1.5 text-xs',
								/* Severity-based background and text colouring */
								issue.severity === 'error'
									? 'bg-red-900/30 text-red-300'
									: issue.severity === 'warning'
										? 'bg-amber-900/30 text-amber-300'
										: 'bg-muted/50 text-muted-foreground',
							)}
						>
							{/* Severity indicator icon */}
							<span className='shrink-0 mt-0.5' aria-hidden='true'>
								{issue.severity === 'error' ? '●' : issue.severity === 'warning' ? '▲' : 'ℹ'}
							</span>
							<span>
								{issue.severity === 'error'
									? t('pptx.accessibility.error')
									: issue.severity === 'warning'
										? t('pptx.accessibility.warning')
										: t('pptx.accessibility.info')}
								{issue.message}
							</span>
						</div>
					))
				)}
			</div>
		</div>
	);
}
