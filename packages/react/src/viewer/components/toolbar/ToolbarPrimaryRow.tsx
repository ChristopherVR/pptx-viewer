import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuMessageSquare, LuPanelLeft, LuPanelRight, LuSettings, LuSparkles } from 'react-icons/lu';

import { cn } from '../../utils';
import { useCollaboration, UserAvatarBar } from '../collaboration';
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
		onToggleSidebar,
		onToggleInspector,
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
						<span className='absolute -top-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary text-[8px] text-white leading-none'>
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
						className='mx-1 rounded-sm px-1 py-0.5 hover:bg-accent/60 transition-colors cursor-pointer'
						title={t('pptx.toolbar.sharingUsers', { count: collab.connectedCount })}
					>
						<UserAvatarBar
							remoteUsers={collab.remoteUsers}
							localUserName={collab.config.userName}
							localUserColor={collab.config.userColor ?? '#6366f1'}
							localUserAvatar={collab.config.userAvatar}
							status={collab.status}
						/>
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

			{/* AI assistant: only rendered when the host opts in via the `ai` prop */}
			{p.aiEnabled && (mode === 'edit' || mode === 'master') && (
				<button
					type='button'
					onClick={p.onToggleAiPanel}
					className={cn(qab, p.isAiPanelOpen ? 'text-primary' : 'text-muted-foreground')}
					title={t('pptx.toolbar.toggleAiAssistant')}
					aria-label={t('pptx.toolbar.toggleAiAssistant')}
				>
					<LuSparkles className={ic} />
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
