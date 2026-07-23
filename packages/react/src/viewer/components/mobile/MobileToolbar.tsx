import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuDownload,
	LuMenu,
	LuPresentation,
	LuRedo,
	LuShare2,
	LuSparkles,
	LuUndo,
} from 'react-icons/lu';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import { cn } from '../../utils';
import type { ToolbarProps } from '../toolbar/toolbar-types';
import { MobileMenuSheet } from './MobileMenuSheet';

/**
 * Mobile-first replacement for the desktop ribbon toolbar.
 *
 * Renders a single compact row of essential controls:
 *   menu · undo · redo · [filename] · present · share
 *
 * All section-specific functionality (Home/Insert/Design/etc.) lives in the
 * MobileMenuSheet that opens from the hamburger menu, and the contextual
 * action bar at the bottom of the screen handles common per-selection tasks.
 */
export function MobileToolbar(props: ToolbarProps): React.ReactElement {
	const { t } = useTranslation();
	const { mode, canUndo, canRedo, onUndo, onRedo, onSetMode, onSaveAsPptx } = props;
	const [menuOpen, setMenuOpen] = useState(false);
	const { isHidden } = useToolbarVisibility(props.hiddenActions);

	const showEdit = mode === 'edit' || mode === 'master';

	const btn =
		'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-foreground/80 hover:bg-accent/60 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform';

	return (
		<div
			role='toolbar'
			aria-label={t('pptx.mobileToolbar.toolbar')}
			className='relative z-20 flex items-center gap-1 px-2 py-1 border-b border-border bg-secondary/50 min-h-[52px] pt-[max(env(safe-area-inset-top),0px)]'
		>
			{/* Menu button (opens sheet with all sections) */}
			{showEdit && (
				<button
					type='button'
					onClick={() => setMenuOpen(true)}
					className={btn}
					title={t('pptx.mobileToolbar.menu')}
					aria-label={t('pptx.mobileToolbar.menu')}
				>
					<LuMenu className='w-5 h-5' />
				</button>
			)}

			{/* Undo / Redo */}
			{showEdit && !isHidden('undo') && (
				<button
					type='button'
					onClick={onUndo}
					disabled={!canUndo}
					className={btn}
					title={t('pptx.toolbar.undo')}
					aria-label={t('pptx.toolbar.undo')}
				>
					<LuUndo className='w-5 h-5' />
				</button>
			)}
			{showEdit && !isHidden('redo') && (
				<button
					type='button'
					onClick={onRedo}
					disabled={!canRedo}
					className={btn}
					title={t('pptx.toolbar.redo')}
					aria-label={t('pptx.toolbar.redo')}
				>
					<LuRedo className='w-5 h-5' />
				</button>
			)}

			{/* Flexible spacer (could hold filename later) */}
			<div className='flex-1' />

			{/* AI assistant toggle: surfaced in the top-right on mobile too (the
			    desktop quick-access bar is replaced by this toolbar on mobile, so
			    without this the assistant was unreachable). Host opts in via `ai`. */}
			{showEdit && props.aiEnabled && (
				<button
					type='button'
					onClick={props.onToggleAiPanel}
					className={cn(btn, props.isAiPanelOpen ? 'text-primary' : undefined)}
					title={t('pptx.toolbar.toggleAiAssistant')}
					aria-label={t('pptx.toolbar.toggleAiAssistant')}
				>
					<LuSparkles className='w-5 h-5' />
				</button>
			)}

			{/* Save / download: surfaced directly so it's reachable without
			    digging into Menu → File, and available even in view-only mode
			    where the Menu button is hidden. */}
			<button
				type='button'
				onClick={onSaveAsPptx}
				className={btn}
				title={t('pptx.toolbar.save', 'Save')}
				aria-label={t('pptx.toolbar.save', 'Save')}
			>
				<LuDownload className='w-5 h-5' />
			</button>

			{/* Present (mobile's equivalent of the status bar's fullscreen toggle) */}
			{!isHidden('fullscreen') && (
				<button
					type='button'
					onClick={() => onSetMode('present')}
					className={cn(btn, 'text-primary')}
					title={t('pptx.toolbar.present')}
					aria-label={t('pptx.toolbar.present')}
				>
					<LuPresentation className='w-5 h-5' />
				</button>
			)}

			{/* Share */}
			{showEdit && !isHidden('share') && (
				<button
					type='button'
					onClick={props.onOpenShareDialog ?? props.onPackageForSharing}
					className={cn(btn, 'bg-primary text-white hover:bg-primary/90 px-3')}
					title={t('pptx.toolbar.share')}
					aria-label={t('pptx.toolbar.share')}
				>
					<LuShare2 className='w-4 h-4' />
				</button>
			)}

			{/* Section sheet */}
			<MobileMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} {...props} />
		</div>
	);
}
