import {
	resolveTitleBarStatusKey,
	TITLE_BAR_CLASSES as TB,
	TITLE_BAR_DEFAULT_FILE_KEY,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuRedo, LuSave, LuSearch, LuUndo } from 'react-icons/lu';

import type { AutosaveStatus } from '../../hooks/useAutosave';
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
}

/**
 * PowerPoint-style title bar: AutoSave toggle, quick-access Save/Undo/Redo,
 * file name + save-location status, and a centred search box that opens the
 * Find & Replace panel. Rendered above (outside) the ribbon toolbar.
 */
export function TitleBar(p: TitleBarProps): React.ReactElement {
	const { t } = useTranslation();
	const editing = (p.mode === 'edit' || p.mode === 'master') && p.canEdit;

	const statusKey = resolveTitleBarStatusKey({
		autosaveState: p.autosaveStatus?.state ?? 'idle',
		isDirty: p.isDirty,
		autosaveEnabled: p.autosaveEnabled,
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
					<button
						type='button'
						onClick={p.onToggleFindReplace}
						className={cn(TB.searchBox, p.findReplaceOpen && 'text-foreground bg-background')}
						title={t('pptx.findReplace.title')}
						aria-label={t('pptx.titleBar.search')}
					>
						<LuSearch className={TB.searchIcon} />
						<span className={TB.searchLabel}>{t('pptx.titleBar.search')}</span>
					</button>
				)}
			</span>

			{/* Right block mirrors the left visually; kept minimal. */}
			<span className={TB.rightSpacer} />
		</div>
	);
}
