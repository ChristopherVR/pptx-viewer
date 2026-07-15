import { buildCollaborationShareUrl } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuCopy, LuUsers, LuWifi, LuWifiOff } from 'react-icons/lu';

import type { CollaborationConfig } from '../hooks/collaboration/types';
import { useCollaboration } from './collaboration';

function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/u);
	return parts.length >= 2
		? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
		: name.slice(0, 2).toUpperCase();
}

function isP2P(config: { transport?: string; serverUrl?: string }): boolean {
	return config.transport === 'webrtc' || !config.serverUrl?.trim();
}

function shareUrl(config: CollaborationConfig): string {
	return buildCollaborationShareUrl(
		config,
		typeof window === 'undefined'
			? undefined
			: { origin: window.location.origin, pathname: window.location.pathname },
	);
}

export function ActiveSessionView({
	collab,
	activeCollaboration,
	copied,
	onCopyRoomId,
	onStopCollaboration,
}: {
	collab: NonNullable<ReturnType<typeof useCollaboration>>;
	activeCollaboration?: CollaborationConfig;
	copied: boolean;
	onCopyRoomId: () => void;
	onStopCollaboration?: () => void;
}) {
	const { t } = useTranslation();
	const statusColor =
		collab.status === 'connected'
			? 'text-green-400'
			: collab.status === 'connecting'
				? 'text-yellow-400'
				: 'text-red-400';

	const statusIcon =
		collab.status === 'connected' || collab.status === 'connecting' ? (
			<LuWifi className='w-4 h-4' />
		) : (
			<LuWifiOff className='w-4 h-4' />
		);

	return (
		<div className='space-y-4'>
			{/* Status */}
			<div className='flex items-center gap-2'>
				<span className={statusColor}>{statusIcon}</span>
				<span className='text-[13px] font-medium text-foreground capitalize'>{collab.status}</span>
				<span className='text-[12px] text-muted-foreground ml-auto flex items-center gap-1'>
					<LuUsers className='w-3.5 h-3.5' />
					{t('pptx.collaboration.userCount', { count: collab.connectedCount })}
				</span>
			</div>

			{/* Share URL */}
			<div className='space-y-1.5'>
				<label className='block text-[12px] font-medium text-foreground'>
					{t('pptx.share.shareLink')}
				</label>
				<div className='flex items-center gap-2'>
					<div className='flex-1 px-3 py-1.5 rounded border border-border bg-background text-[11px] text-foreground select-all font-mono truncate'>
						{shareUrl(collab.config)}
					</div>
					<button
						type='button'
						onClick={onCopyRoomId}
						className='flex items-center gap-1 px-2.5 py-1.5 rounded border border-border bg-muted hover:bg-accent text-[12px] text-foreground transition-colors shrink-0'
						title={t('pptx.share.copyLink')}
					>
						{copied ? (
							<>
								<LuCheck className='w-3.5 h-3.5 text-green-400' />
								<span>{t('pptx.share.copied')}</span>
							</>
						) : (
							<>
								<LuCopy className='w-3.5 h-3.5' />
								<span>{t('pptx.share.copyUrl')}</span>
							</>
						)}
					</button>
				</div>
				<p className='text-[11px] text-muted-foreground'>{t('pptx.share.shareHint')}</p>
			</div>

			{/* Session details */}
			<div className='flex items-center gap-3 text-[11px] text-muted-foreground'>
				<span>
					{t('pptx.share.room')}{' '}
					<code className='font-mono text-foreground'>{collab.config.roomId}</code>
				</span>
				<span>
					{t('pptx.share.server')}{' '}
					<code className='font-mono text-foreground'>
						{isP2P(collab.config) ? t('pptx.share.p2pServerValue') : collab.config.serverUrl}
					</code>
				</span>
			</div>

			{/* Connected users list */}
			{collab.remoteUsers.length > 0 && (
				<div className='space-y-1.5'>
					<label className='block text-[12px] font-medium text-foreground'>
						{t('pptx.share.connectedUsers')}
					</label>
					<div className='rounded border border-border bg-background divide-y divide-border max-h-[140px] overflow-y-auto'>
						{/* Local user */}
						<div className='flex items-center gap-2 px-3 py-2'>
							<div
								className='w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0'
								style={{ backgroundColor: collab.config.userColor ?? '#6366f1' }}
							>
								{getInitials(activeCollaboration?.userName ?? collab.config.userName)}
							</div>
							<span className='text-[12px] text-foreground truncate'>
								{activeCollaboration?.userName ?? collab.config.userName}
							</span>
							<span className='text-[10px] text-muted-foreground ml-auto'>
								{t('pptx.share.you')}
							</span>
						</div>
						{/* Remote users */}
						{collab.remoteUsers.map((user) => (
							<div key={user.clientId} className='flex items-center gap-2 px-3 py-2'>
								<div
									className='w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0'
									style={{ backgroundColor: user.userColor }}
								>
									{user.userAvatar ? (
										<img
											src={user.userAvatar}
											alt=''
											className='w-full h-full rounded-full object-cover'
										/>
									) : (
										getInitials(user.userName)
									)}
								</div>
								<span className='text-[12px] text-foreground truncate'>{user.userName}</span>
								<span className='text-[10px] text-muted-foreground ml-auto'>
									Slide {user.activeSlideIndex + 1}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Stop sharing */}
			{onStopCollaboration && (
				<button
					type='button'
					onClick={onStopCollaboration}
					className='w-full px-3 py-2 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-[12px] text-red-400 font-medium transition-colors'
				>
					{t('pptx.share.stopSharing')}
				</button>
			)}
		</div>
	);
}
