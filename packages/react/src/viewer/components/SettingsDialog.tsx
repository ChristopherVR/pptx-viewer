import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuSettings, LuX } from 'react-icons/lu';

import { SHORTCUT_REFERENCE_ITEMS } from '../constants';
import { cn } from '../utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	spellCheckEnabled?: boolean;
	onSetSpellCheckEnabled?: (v: boolean) => void;
	showGrid?: boolean;
	onSetShowGrid?: (v: boolean) => void;
	showRulers?: boolean;
	onSetShowRulers?: (v: boolean) => void;
	snapToGrid?: boolean;
	onSetSnapToGrid?: (v: boolean) => void;
	reducedMotion?: boolean;
	onToggleReducedMotion?: () => void;
}

type SettingsTab = 'general' | 'shortcuts';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToggleSwitch({
	label,
	enabled,
	onToggle,
}: {
	label: string;
	enabled: boolean;
	onToggle: () => void;
}): React.ReactElement {
	return (
		<div className='flex items-center justify-between py-2.5 px-3'>
			<span className='text-sm text-foreground'>{label}</span>
			<button
				type='button'
				onClick={onToggle}
				className={cn(
					'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
					enabled ? 'bg-primary' : 'bg-muted-foreground/30',
				)}
				role='switch'
				aria-checked={enabled}
				aria-label={label}
			>
				<span
					className={cn(
						'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
						enabled ? 'translate-x-[18px]' : 'translate-x-[3px]',
					)}
				/>
			</button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsDialog({
	isOpen,
	onClose,
	spellCheckEnabled = false,
	onSetSpellCheckEnabled,
	showGrid = false,
	onSetShowGrid,
	showRulers = false,
	onSetShowRulers,
	snapToGrid = false,
	onSetSnapToGrid,
	reducedMotion = false,
	onToggleReducedMotion,
}: SettingsDialogProps): React.ReactElement | null {
	const [activeTab, setActiveTab] = useState<SettingsTab>('general');
	const [autoSave, setAutoSave] = useState(true);
	const { t } = useTranslation();

	// Close on Escape
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		},
		[onClose],
	);

	useEffect(() => {
		if (isOpen) {
			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}
	}, [isOpen, handleKeyDown]);

	if (!isOpen) {
		return null;
	}

	const tabs: Array<{ id: SettingsTab; label: string }> = [
		{ id: 'general', label: t('pptx.settings.general') },
		{ id: 'shortcuts', label: t('pptx.settings.keyboardShortcuts') },
	];

	return (
		<>
			{/* Backdrop */}
			<button
				type='button'
				style={{ zIndex: 1200 }}
				className='fixed inset-0 bg-black/60'
				aria-label={t('pptx.settings.closeSettings')}
				onClick={onClose}
			/>
			{/* Dialog */}
			<div
				style={{ zIndex: 1201 }}
				className='fixed inset-0 flex items-center justify-center pointer-events-none'
			>
				<div className='pointer-events-auto w-[min(32rem,calc(100%-2rem))] rounded-xl border border-border bg-popover backdrop-blur-xl shadow-2xl'>
					{/* Header */}
					<div className='flex items-center justify-between px-5 py-4 border-b border-border/60'>
						<div className='flex items-center gap-2'>
							<LuSettings className='w-5 h-5 text-primary' />
							<h2 className='text-sm font-semibold text-foreground'>{t('pptx.settings.title')}</h2>
						</div>
						<button
							type='button'
							onClick={onClose}
							className='p-1 rounded hover:bg-accent transition-colors'
							aria-label={t('pptx.settings.close')}
						>
							<LuX className='w-4 h-4 text-muted-foreground' />
						</button>
					</div>

					{/* Tab bar */}
					<div className='flex border-b border-border/60 px-5'>
						{tabs.map((tab) => (
							<button
								key={tab.id}
								type='button'
								onClick={() => setActiveTab(tab.id)}
								className={cn(
									'px-3 py-2 text-xs font-medium transition-colors relative',
									activeTab === tab.id
										? 'text-primary'
										: 'text-muted-foreground hover:text-foreground',
								)}
							>
								{tab.label}
								{activeTab === tab.id && (
									<span className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full' />
								)}
							</button>
						))}
					</div>

					{/* Content */}
					<div className='px-5 py-4 max-h-[60vh] overflow-y-auto'>
						{activeTab === 'general' && (
							<div className='space-y-0.5'>
								<ToggleSwitch
									label={t('pptx.settings.autoSave')}
									enabled={autoSave}
									onToggle={() => setAutoSave(!autoSave)}
								/>
								<ToggleSwitch
									label={t('pptx.settings.spellCheck')}
									enabled={spellCheckEnabled}
									onToggle={() => onSetSpellCheckEnabled?.(!spellCheckEnabled)}
								/>
								<ToggleSwitch
									label={t('pptx.settings.showGrid')}
									enabled={showGrid}
									onToggle={() => onSetShowGrid?.(!showGrid)}
								/>
								<ToggleSwitch
									label={t('pptx.settings.showRulers')}
									enabled={showRulers}
									onToggle={() => onSetShowRulers?.(!showRulers)}
								/>
								<ToggleSwitch
									label={t('pptx.settings.snapToGrid')}
									enabled={snapToGrid}
									onToggle={() => onSetSnapToGrid?.(!snapToGrid)}
								/>
								<ToggleSwitch
									label={t('pptx.settings.reducedMotion')}
									enabled={reducedMotion}
									onToggle={() => onToggleReducedMotion?.()}
								/>
							</div>
						)}

						{activeTab === 'shortcuts' && (
							<div className='space-y-0.5'>
								{SHORTCUT_REFERENCE_ITEMS.map((shortcut, i) => (
									<div
										key={shortcut.action}
										className={cn(
											'flex items-center justify-between gap-3 rounded px-3 py-2',
											i % 2 === 0 ? 'bg-muted/60' : '',
										)}
									>
										<span className='text-xs text-foreground'>{shortcut.action}</span>
										<span className='font-mono text-[11px] text-muted-foreground whitespace-nowrap'>
											{shortcut.shortcut}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
