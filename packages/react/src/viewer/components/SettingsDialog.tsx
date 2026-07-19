import type {
	ThemeCatalogEntry,
	ToolbarTabId,
	ViewerAddinStatus,
	ViewerOptions,
	ViewerOptionsGroupId,
	ViewerOptionsTabId,
} from 'pptx-viewer-shared';
import { DEFAULT_QUICK_ACCESS_COMMAND_IDS, VIEWER_OPTIONS_TABS } from 'pptx-viewer-shared';
import type { PptxAiChatStore } from 'pptx-viewer-shared/ai';
import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuSettings, LuX } from 'react-icons/lu';

import { useModalDismissDrag } from '../hooks';
import { cn } from '../utils';
import { OptionsAddInsPane } from './settings/OptionsAddInsPane';
import { OptionsPane } from './settings/OptionsPane';
import { OptionsQuickAccessPane } from './settings/OptionsQuickAccessPane';
import { OptionsRibbonPane } from './settings/OptionsRibbonPane';
import { SettingsAiTab } from './SettingsAiTab';
import { SettingsAppearanceTab } from './SettingsAppearanceTab';
import { SettingsLanguageTab } from './SettingsLanguageTab';

/** Synthetic tab id for the AI section (appended only when `aiEnabled`). */
const AI_TAB_ID = 'ai';
type SettingsTabId = ViewerOptionsTabId | typeof AI_TAB_ID;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	/** Full File > Options snapshot rendered by every pane. */
	options: ViewerOptions;
	onOptionChange: (
		group: ViewerOptionsGroupId,
		key: string,
		value: boolean | number | string,
	) => void;
	/** Restore a snapshot wholesale (Cancel semantics). */
	onRestoreOptions: (options: ViewerOptions) => void;
	onRibbonTabHiddenChange: (tabId: ToolbarTabId, hidden: boolean) => void;
	onQuickAccessCommandsChange: (commandIds: string[]) => void;
	onResetOptions: (group?: ViewerOptionsGroupId) => void;
	/** Options > Save > "Delete cached files". */
	onClearCache: () => void;
	/** Availability flags for the Add-ins pane. */
	addinStatus?: ViewerAddinStatus;
	/** Key of the currently active theme catalog entry. */
	themeKey: string;
	availableThemes: readonly ThemeCatalogEntry[];
	onSelectTheme: (key: string) => void;
	/** Currently active locale code. */
	localeCode: string;
	availableLocales: readonly LocaleCatalogEntry[];
	onSelectLocale: (code: string) => void;
	/** When true, an "AI" section is shown for exporting detailed chat logs. */
	aiEnabled?: boolean;
	/** Chat store the AI section reads from (defaults to the shared store). */
	chatStore?: PptxAiChatStore;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * File > Options: a PowerPoint Options-style dialog with the ten shared
 * categories in a left rail and schema-driven panes on the right. Changes
 * apply live; Cancel restores the snapshot taken when the dialog opened.
 */
export function SettingsDialog({
	isOpen,
	onClose,
	options,
	onOptionChange,
	onRestoreOptions,
	onRibbonTabHiddenChange,
	onQuickAccessCommandsChange,
	onResetOptions,
	onClearCache,
	addinStatus,
	themeKey,
	availableThemes,
	onSelectTheme,
	localeCode,
	availableLocales,
	onSelectLocale,
	aiEnabled,
	chatStore,
}: SettingsDialogProps): React.ReactElement | null {
	const [activeTabId, setActiveTabId] = useState<SettingsTabId>('general');
	const { t } = useTranslation();
	const { panelStyle, handlers: dragHandlers } = useModalDismissDrag(onClose);
	const snapshotRef = useRef<ViewerOptions | null>(null);
	const wasOpenRef = useRef(false);

	// Snapshot on open for Cancel semantics.
	useEffect(() => {
		if (isOpen && !wasOpenRef.current) {
			snapshotRef.current = options;
		}
		wasOpenRef.current = isOpen;
	}, [isOpen, options]);

	const handleCancel = useCallback(() => {
		if (snapshotRef.current) {
			onRestoreOptions(snapshotRef.current);
		}
		onClose();
	}, [onClose, onRestoreOptions]);

	// Close (confirming) on Escape.
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

	const activeTab =
		VIEWER_OPTIONS_TABS.find((tab) => tab.id === activeTabId) ?? VIEWER_OPTIONS_TABS[0];
	if (!activeTab) {
		return null;
	}

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
				<div
					style={panelStyle}
					role='dialog'
					aria-modal='true'
					aria-label={t('pptx.options.title')}
					className='pointer-events-auto flex max-h-[85vh] w-[min(56rem,calc(100%-2rem))] flex-col rounded-xl border border-border bg-popover shadow-2xl backdrop-blur-xl max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[88dvh] max-md:w-full max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]'
				>
					{/* Header - also a swipe-down-to-dismiss grab region on touch. */}
					<div
						{...dragHandlers}
						className='flex items-center justify-between border-b border-border/60 px-5 py-4 touch-none'
					>
						<div className='flex items-center gap-2'>
							<LuSettings className='h-5 w-5 text-primary' />
							<h2 className='text-sm font-semibold text-foreground'>{t('pptx.options.title')}</h2>
						</div>
						<button
							type='button'
							onClick={onClose}
							className='rounded p-1 transition-colors hover:bg-accent'
							aria-label={t('pptx.settings.close')}
						>
							<LuX className='h-4 w-4 text-muted-foreground' />
						</button>
					</div>

					{/* Body: category rail + pane */}
					<div className='flex min-h-0 flex-1 max-md:flex-col'>
						<nav
							aria-label={t('pptx.options.title')}
							className='w-44 shrink-0 space-y-0.5 overflow-y-auto border-r border-border/60 p-2 max-md:flex max-md:w-full max-md:space-y-0 max-md:gap-1 max-md:overflow-x-auto max-md:border-b max-md:border-r-0'
						>
							{VIEWER_OPTIONS_TABS.map((tab) => (
								<button
									key={tab.id}
									type='button'
									onClick={() => setActiveTabId(tab.id)}
									aria-current={activeTabId === tab.id}
									className={cn(
										'block w-full whitespace-nowrap rounded px-3 py-2 text-left text-sm transition-colors max-md:w-auto',
										activeTabId === tab.id
											? 'bg-primary/10 font-medium text-primary'
											: 'text-foreground hover:bg-accent',
									)}
								>
									{t(tab.labelKey)}
								</button>
							))}
							{aiEnabled && (
								<button
									type='button'
									onClick={() => setActiveTabId(AI_TAB_ID)}
									aria-current={activeTabId === AI_TAB_ID}
									className={cn(
										'block w-full whitespace-nowrap rounded px-3 py-2 text-left text-sm transition-colors max-md:w-auto',
										activeTabId === AI_TAB_ID
											? 'bg-primary/10 font-medium text-primary'
											: 'text-foreground hover:bg-accent',
									)}
								>
									{t('pptx.ai.settingsSectionTitle')}
								</button>
							)}
						</nav>

						<div className='min-h-0 flex-1 overflow-y-auto px-5 py-4'>
							{activeTabId === AI_TAB_ID ? (
								<div className='space-y-4'>
									<p className='text-sm font-medium text-foreground'>
										{t('pptx.ai.settingsSectionTitle')}
									</p>
									<SettingsAiTab store={chatStore} />
								</div>
							) : activeTab.custom === 'language' ? (
								<div className='space-y-4'>
									<p className='text-sm font-medium text-foreground'>
										{t(activeTab.descriptionKey)}
									</p>
									<section>
										<h3 className='mb-1 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
											{t('pptx.options.language.displayLanguage')}
										</h3>
										<p className='mb-2 text-xs text-muted-foreground'>
											{t('pptx.options.language.displayLanguageDescription')}
										</p>
										<SettingsLanguageTab
											activeLocale={localeCode}
											locales={availableLocales}
											onSelectLocale={onSelectLocale}
										/>
									</section>
								</div>
							) : activeTab.custom === 'ribbon' ? (
								<div className='space-y-4'>
									<p className='text-sm font-medium text-foreground'>
										{t(activeTab.descriptionKey)}
									</p>
									<OptionsRibbonPane
										options={options}
										onRibbonTabHiddenChange={onRibbonTabHiddenChange}
										onResetRibbon={() => onResetOptions('ribbon')}
									/>
								</div>
							) : activeTab.custom === 'addIns' ? (
								<div className='space-y-4'>
									<p className='text-sm font-medium text-foreground'>
										{t(activeTab.descriptionKey)}
									</p>
									<OptionsAddInsPane addinStatus={addinStatus} />
								</div>
							) : (
								<OptionsPane
									tab={activeTab}
									options={options}
									onOptionChange={onOptionChange}
									renderSpecial={(section) => {
										if (section.special === 'themePicker') {
											return (
												<div className='mt-2'>
													<SettingsAppearanceTab
														activeThemeKey={themeKey}
														themes={availableThemes}
														onSelectTheme={onSelectTheme}
													/>
												</div>
											);
										}
										if (section.special === 'clearCache') {
											return (
												<div className='mt-2'>
													<p className='mb-2 text-xs text-muted-foreground'>
														{t('pptx.options.save.clearCacheDescription')}
													</p>
													<button
														type='button'
														onClick={onClearCache}
														className='rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent'
													>
														{t('pptx.options.save.clearCacheNow')}
													</button>
												</div>
											);
										}
										return null;
									}}
								>
									{activeTab.custom === 'quickAccess' && (
										<OptionsQuickAccessPane
											options={options}
											onQuickAccessCommandsChange={onQuickAccessCommandsChange}
											onResetQuickAccess={() =>
												onQuickAccessCommandsChange([...DEFAULT_QUICK_ACCESS_COMMAND_IDS])
											}
										/>
									)}
								</OptionsPane>
							)}
						</div>
					</div>

					{/* Footer */}
					<div className='flex items-center justify-between gap-2 border-t border-border/60 px-5 py-3'>
						<button
							type='button'
							onClick={() => onResetOptions()}
							className='rounded border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
						>
							{t('pptx.options.resetAll')}
						</button>
						<div className='flex items-center gap-2'>
							<button
								type='button'
								onClick={handleCancel}
								className='rounded border border-border px-4 py-1.5 text-xs text-foreground transition-colors hover:bg-accent'
							>
								{t('pptx.common.cancel')}
							</button>
							<button
								type='button'
								onClick={onClose}
								className='rounded bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90'
							>
								{t('pptx.common.ok')}
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
