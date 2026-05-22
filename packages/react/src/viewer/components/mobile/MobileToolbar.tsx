import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMenu, LuPresentation, LuRedo, LuShare2, LuUndo } from 'react-icons/lu';

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
	const { mode, canUndo, canRedo, onUndo, onRedo, onSetMode } = props;
	const [menuOpen, setMenuOpen] = useState(false);

	const showEdit = mode === 'edit' || mode === 'master';

	const btn =
		'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-foreground/80 hover:bg-accent/60 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform';

	return (
		<div
			role='toolbar'
			aria-label='Toolbar'
			className='relative z-20 flex items-center gap-1 px-2 py-1 border-b border-border bg-secondary/50 min-h-[52px] pt-[max(env(safe-area-inset-top),0px)]'
		>
			{/* Menu button (opens sheet with all sections) */}
			{showEdit && (
				<button
					type='button'
					onClick={() => setMenuOpen(true)}
					className={btn}
					title='Menu'
					aria-label='Menu'
				>
					<LuMenu className='w-5 h-5' />
				</button>
			)}

			{/* Undo / Redo */}
			{showEdit && (
				<>
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
				</>
			)}

			{/* Flexible spacer (could hold filename later) */}
			<div className='flex-1' />

			{/* Present */}
			<button
				type='button'
				onClick={() => onSetMode('present')}
				className={cn(btn, 'text-primary')}
				title={t('pptx.toolbar.present')}
				aria-label={t('pptx.toolbar.present')}
			>
				<LuPresentation className='w-5 h-5' />
			</button>

			{/* Share */}
			{showEdit && (
				<button
					type='button'
					onClick={props.onOpenShareDialog ?? props.onPackageForSharing}
					className={cn(btn, 'bg-primary text-primary-foreground hover:bg-primary/90 px-3')}
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
