import {
	filterCommands,
	resolveTitleBarStatusKey,
	TITLE_BAR_CLASSES as TB,
	TITLE_BAR_DEFAULT_FILE_KEY,
} from 'pptx-viewer-shared';
import type { CommandSearchEntry, ToolbarActionId } from 'pptx-viewer-shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRedo, LuSave, LuSearch, LuUndo } from 'react-icons/lu';

import type { AutosaveStatus } from '../../hooks/useAutosave';
import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import type { ViewerMode } from '../../types';
import { cn } from '../../utils';

export interface TitleBarProps {
	mode: ViewerMode;
	canEdit: boolean;
	/** Display name of the open document (host-supplied). */
	fileName?: string;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	autosaveEnabled: boolean;
	onToggleAutosave: () => void;
	canUndo: boolean;
	canRedo: boolean;
	undoLabel?: string | null;
	redoLabel?: string | null;
	onUndo: () => void;
	onRedo: () => void;
	/** Quick-access save (downloads the .pptx). */
	onSave?: () => void;
	findReplaceOpen: boolean;
	onToggleFindReplace: () => void;
	/** Dispatch a command from the search palette. */
	onCommandSearch?: (command: string) => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
}

/**
 * PowerPoint-style title bar: AutoSave toggle, quick-access Save/Undo/Redo,
 * file name + save-location status, and a centred search box that opens the
 * Find & Replace panel. Rendered above (outside) the ribbon toolbar.
 */
export function TitleBar(p: TitleBarProps): React.ReactElement {
	const { t } = useTranslation();
	const editing = (p.mode === 'edit' || p.mode === 'master') && p.canEdit;
	const { isHidden } = useToolbarVisibility(p.hiddenActions);

	const [searchQuery, setSearchQuery] = useState('');
	const [searchFocused, setSearchFocused] = useState(false);
	const searchRef = useRef<HTMLDivElement>(null);

	const commandResults = filterCommands(searchQuery, t);

	const handleCommandSelect = useCallback(
		(entry: CommandSearchEntry) => {
			p.onCommandSearch?.(entry.command);
			setSearchQuery('');
			setSearchFocused(false);
		},
		[p],
	);

	const handleSearchKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' && searchQuery.trim()) {
				if (commandResults.length > 0) {
					handleCommandSelect(commandResults[0]);
				} else {
					p.onToggleFindReplace();
					setSearchFocused(false);
				}
			} else if (e.key === 'Escape') {
				setSearchQuery('');
				setSearchFocused(false);
			}
		},
		[searchQuery, commandResults, handleCommandSelect, p],
	);

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
				setSearchFocused(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);

	const statusKey = resolveTitleBarStatusKey({
		autosaveState: p.autosaveStatus?.state ?? 'idle',
		isDirty: p.isDirty,
		autosaveEnabled: p.autosaveEnabled,
		disabledReason: p.autosaveStatus?.state === 'disabled' ? p.autosaveStatus.reason : undefined,
	});

	return (
		<div className={TB.container} data-pptx-title-bar=''>
			<span className={TB.logo} aria-hidden='true'>
				P
			</span>

			{editing && (
				<>
					<span className={TB.autosaveGroup}>
						<span className={TB.autosaveLabel}>{t('pptx.titleBar.autoSave')}</span>
						<button
							type='button'
							role='switch'
							aria-checked={p.autosaveEnabled}
							onClick={p.onToggleAutosave}
							className={cn(
								TB.toggleTrack,
								p.autosaveEnabled ? TB.toggleTrackOn : TB.toggleTrackOff,
							)}
							title={t('pptx.titleBar.toggleAutoSave')}
							aria-label={t('pptx.titleBar.toggleAutoSave')}
						>
							<span
								className={cn(
									TB.toggleKnob,
									p.autosaveEnabled ? TB.toggleKnobOn : TB.toggleKnobOff,
								)}
							/>
						</button>
						<span className={TB.autosaveLabel}>
							{t(p.autosaveEnabled ? 'pptx.titleBar.autoSaveOn' : 'pptx.titleBar.autoSaveOff')}
						</span>
					</span>

					<div className={TB.separator} />

					{p.onSave && (
						<button
							type='button'
							onClick={p.onSave}
							className={TB.quickButton}
							title={t('pptx.titleBar.save')}
							aria-label={t('pptx.titleBar.save')}
						>
							<LuSave className='w-3.5 h-3.5' />
						</button>
					)}
					{!isHidden('undo') && (
						<button
							type='button'
							onClick={p.onUndo}
							disabled={!p.canUndo}
							className={TB.quickButton}
							title={
								p.undoLabel
									? t('pptx.toolbar.undoAction', { action: p.undoLabel })
									: t('pptx.toolbar.undo')
							}
							aria-label={t('pptx.toolbar.undo')}
						>
							<LuUndo className='w-3.5 h-3.5' />
						</button>
					)}
					{!isHidden('redo') && (
						<button
							type='button'
							onClick={p.onRedo}
							disabled={!p.canRedo}
							className={TB.quickButton}
							title={
								p.redoLabel
									? t('pptx.toolbar.redoAction', { action: p.redoLabel })
									: t('pptx.toolbar.redo')
							}
							aria-label={t('pptx.toolbar.redo')}
						>
							<LuRedo className='w-3.5 h-3.5' />
						</button>
					)}

					<div className={TB.separator} />
				</>
			)}

			<span className={TB.fileGroup}>
				<span className={TB.fileName}>{p.fileName || t(TITLE_BAR_DEFAULT_FILE_KEY)}</span>
				{editing && (
					<>
						<span className={TB.statusDot} aria-hidden='true'>
							&bull;
						</span>
						<span
							className={cn(
								TB.statusText,
								p.autosaveStatus?.state === 'error' && p.autosaveEnabled && TB.statusError,
								p.autosaveStatus?.state === 'saving' && p.autosaveEnabled && TB.statusSaving,
							)}
						>
							{t(statusKey)}
						</span>
					</>
				)}
			</span>

			<span className={TB.searchWrap}>
				{(p.mode === 'edit' || p.mode === 'master') && (
					<div ref={searchRef} className='relative w-full max-w-md'>
						<div
							className={cn(
								TB.searchBox,
								(searchFocused || p.findReplaceOpen) && 'text-foreground bg-background',
							)}
						>
							<LuSearch className={TB.searchIcon} />
							<input
								type='text'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onFocus={() => setSearchFocused(true)}
								onKeyDown={handleSearchKeyDown}
								placeholder={t('pptx.titleBar.searchPlaceholder')}
								className='flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/60'
								aria-label={t('pptx.titleBar.search')}
							/>
						</div>
						{searchFocused && searchQuery.trim() && (
							<div className='absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl max-h-64 overflow-y-auto'>
								{commandResults.length > 0 ? (
									<>
										<div className='px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider'>
											{t('pptx.titleBar.searchCommands')}
										</div>
										{commandResults.slice(0, 8).map((entry) => (
											<button
												key={entry.command}
												type='button'
												className='flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors'
												onMouseDown={() => handleCommandSelect(entry)}
											>
												<span className='truncate'>{t(entry.labelKey)}</span>
												<span className='ml-auto text-[10px] text-muted-foreground capitalize'>
													{entry.category}
												</span>
											</button>
										))}
									</>
								) : (
									<div className='px-3 py-2 text-xs text-muted-foreground'>
										{t('pptx.titleBar.searchNoResults')}
									</div>
								)}
								<div className='border-t border-border/60'>
									<button
										type='button'
										className='flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors'
										onMouseDown={() => {
											p.onToggleFindReplace();
											setSearchFocused(false);
											setSearchQuery('');
										}}
									>
										<LuSearch className='w-3 h-3 shrink-0' />
										<span>
											{t('pptx.titleBar.searchContent')} &ldquo;{searchQuery}&rdquo;
										</span>
									</button>
								</div>
							</div>
						)}
					</div>
				)}
			</span>

			{/* Right block mirrors the left visually; kept minimal. */}
			<span className={TB.rightSpacer} />
		</div>
	);
}
