import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuMessageSquare,
	LuPanelLeft,
	LuPanelRight,
	LuRedo,
	LuSearch,
	LuSettings,
	LuShare2,
	LuUndo,
} from 'react-icons/lu';

import { cn } from '../../utils';
import { useCollaboration } from '../collaboration';
import { CustomShowsControls } from './CustomShowsControls';
import { ModeSwitcher } from './ModeSwitcher';
import { OverflowMenu } from './OverflowMenu';
import { ic, ics, sep } from './toolbar-constants';
import type { ToolbarProps } from './toolbar-types';

export function ToolbarPrimaryRow(p: ToolbarProps): React.ReactElement {
	const { t } = useTranslation();
	const {
		mode,
		canEdit,
		isSidebarCollapsed,
		isInspectorPaneOpen,
		canUndo,
		canRedo,
		undoLabel,
		redoLabel,
		findReplaceOpen,
		onToggleSidebar,
		onToggleInspector,
		onUndo,
		onRedo,
		onToggleFindReplace,
	} = p;

	const collab = useCollaboration();

	const qab =
		'p-1 max-md:p-2 max-md:min-h-[40px] max-md:min-w-[40px] rounded-sm transition-colors hover:bg-accent/60 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 active:opacity-70';

	return (
		<div className='flex items-center gap-0.5 max-md:gap-0 px-1.5 py-0.5 max-md:px-1'>
			{/* Left: Slides pane toggle + Undo/Redo + Find */}
			{mode !== 'present' && (
				<button
					type='button'
					onClick={onToggleSidebar}
					className={cn(qab, !isSidebarCollapsed ? 'text-foreground' : 'text-muted-foreground')}
					title={t('pptx.toolbar.toggleSlidesPanel')}
					aria-label={t('pptx.toolbar.toggleSlidesPanel')}
				>
					<LuPanelLeft className={ic} />
				</button>
			)}
			{sep}
			<button
				type='button'
				onClick={onUndo}
				disabled={!canEdit || !canUndo}
				className={cn(qab, 'text-muted-foreground')}
				title={
					undoLabel ? t('pptx.toolbar.undoAction', { action: undoLabel }) : t('pptx.toolbar.undo')
				}
				aria-label={t('pptx.toolbar.undo')}
			>
				<LuUndo className={ics} />
			</button>
			<button
				type='button'
				onClick={onRedo}
				disabled={!canEdit || !canRedo}
				className={cn(qab, 'text-muted-foreground')}
				title={
					redoLabel ? t('pptx.toolbar.redoAction', { action: redoLabel }) : t('pptx.toolbar.redo')
				}
				aria-label={t('pptx.toolbar.redo')}
			>
				<LuRedo className={ics} />
			</button>
			{(mode === 'edit' || mode === 'master') && (
				<button
					type='button'
					onClick={onToggleFindReplace}
					className={cn(
						qab,
						'max-md:hidden',
						findReplaceOpen ? 'text-foreground' : 'text-muted-foreground',
					)}
					title={t('pptx.findReplace.title')}
					aria-label={t('pptx.findReplace.title')}
				>
					<LuSearch className={ics} />
				</button>
			)}

			{/* Center spacer */}
			<div className='flex-1 min-w-2 max-md:min-w-1' />

			{/* Right: Comments + Present + Share + Inspector + Settings + Overflow */}
			{(mode === 'edit' || mode === 'master') && (
				<button
					type='button'
					onClick={p.onToggleComments}
					className={cn(
						qab,
						'relative max-md:hidden',
						p.isCommentsPanelOpen ? 'text-foreground' : 'text-muted-foreground',
					)}
					title={t('pptx.toolbar.comments')}
					aria-label={t('pptx.toolbar.comments')}
				>
					<LuMessageSquare className={ics} />
					{(p.slideCommentCount ?? 0) > 0 && (
						<span className='absolute -top-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary text-[8px] text-primary-foreground leading-none'>
							{p.slideCommentCount}
						</span>
					)}
				</button>
			)}

			{/* Collaboration user avatars (inline, PowerPoint-style) */}
			{collab &&
				(collab.status === 'connected' || collab.status === 'connecting') &&
				collab.remoteUsers.length > 0 && (
					<button
						type='button'
						onClick={p.onOpenShareDialog}
						className='flex items-center -space-x-1.5 mx-1 rounded-sm px-1 py-0.5 hover:bg-accent/60 transition-colors cursor-pointer'
						title={t('pptx.toolbar.sharingUsers', { count: collab.connectedCount })}
					>
						{collab.remoteUsers.slice(0, 4).map((user) => (
							<div
								key={user.clientId}
								className='w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[8px] font-semibold text-white shrink-0'
								style={{ backgroundColor: user.userColor }}
								title={user.userName}
							>
								{user.userAvatar ? (
									<img
										src={user.userAvatar}
										alt={user.userName}
										className='w-full h-full rounded-full object-cover'
									/>
								) : (
									user.userName.slice(0, 2).toUpperCase()
								)}
							</div>
						))}
						{collab.remoteUsers.length > 4 && (
							<div className='w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] text-muted-foreground shrink-0'>
								+{collab.remoteUsers.length - 4}
							</div>
						)}
					</button>
				)}

			<ModeSwitcher
				mode={p.mode}
				onSetMode={p.onSetMode}
				onCloseMasterView={p.onCloseMasterView}
				onToggleSlideSorter={p.onToggleSlideSorter}
				onEnterPresenterView={p.onEnterPresenterView}
				onEnterRehearsalMode={p.onEnterRehearsalMode}
				onOpenSetUpSlideShow={p.onOpenSetUpSlideShow}
				onOpenBroadcastDialog={p.onOpenBroadcastDialog}
				onToggleSubtitles={p.onToggleSubtitles}
				showSubtitles={p.showSubtitles}
			/>

			<CustomShowsControls
				customShows={p.customShows}
				activeCustomShowId={p.activeCustomShowId}
				canEdit={p.canEdit}
				isCurrentSlideInActiveShow={p.isCurrentSlideInActiveShow}
				onSetActiveCustomShowId={p.onSetActiveCustomShowId}
				onCreateCustomShow={p.onCreateCustomShow}
				onRenameActiveCustomShow={p.onRenameActiveCustomShow}
				onDeleteActiveCustomShow={p.onDeleteActiveCustomShow}
				onToggleCurrentSlideInActiveShow={p.onToggleCurrentSlideInActiveShow}
			/>

			{sep}

			{/* Share button — shows user count when collaborating */}
			{(mode === 'edit' || mode === 'master') && (
				<button
					type='button'
					onClick={p.onOpenShareDialog ?? p.onPackageForSharing}
					className={cn(
						'relative inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors',
						collab && collab.status === 'connected'
							? 'bg-green-600 hover:bg-green-500 text-white'
							: 'bg-primary hover:bg-primary/90 text-primary-foreground',
					)}
					title={
						collab && collab.status === 'connected'
							? t('pptx.toolbar.sharingUsers', { count: collab.connectedCount })
							: t('pptx.toolbar.share')
					}
					aria-label={t('pptx.toolbar.share')}
				>
					<LuShare2 className='w-3 h-3' />
					<span className='max-md:hidden'>
						{collab && collab.status === 'connected'
							? t('pptx.toolbar.sharingCount', { count: collab.connectedCount })
							: t('pptx.toolbar.share')}
					</span>
				</button>
			)}

			{(mode === 'edit' || mode === 'master') && (
				<button
					type='button'
					onClick={onToggleInspector}
					className={cn(qab, isInspectorPaneOpen ? 'text-foreground' : 'text-muted-foreground')}
					title={t('pptx.toolbar.toggleInspector')}
					aria-label={t('pptx.toolbar.toggleInspector')}
				>
					<LuPanelRight className={ic} />
				</button>
			)}

			{/* Settings */}
			<button
				type='button'
				onClick={p.onOpenSettings ?? p.onToggleShortcuts}
				className={cn(qab, 'text-muted-foreground')}
				title={t('pptx.toolbar.settingsShortcuts')}
				aria-label={t('pptx.toolbar.settings')}
			>
				<LuSettings className={ics} />
			</button>

			{!canEdit && (
				<span className='inline-flex items-center px-2 py-0.5 rounded-sm bg-amber-600/90 text-[10px] text-amber-50'>
					{t('pptx.toolbar.readOnly')}
				</span>
			)}
			<OverflowMenu {...p} />
		</div>
	);
}
