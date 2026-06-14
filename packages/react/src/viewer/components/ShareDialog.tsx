/**
 * ShareDialog — Modal dialog for starting/managing real-time collaboration.
 *
 * When collaboration is NOT active, shows controls to configure and start a
 * collaboration session (room name, user name, server URL).
 *
 * When collaboration IS active (a `CollaborationProvider` is present and
 * connected), shows session info, connected users, and a stop button.
 *
 * @module ShareDialog
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuCheck, LuUsers, LuWifi, LuWifiOff } from 'react-icons/lu';

import type { CollaborationConfig } from '../hooks/collaboration/types';
import { useCollaboration } from './collaboration';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShareDialogProps {
	/** Whether the dialog is open. */
	open: boolean;
	/** Callback to close the dialog. */
	onClose: () => void;
	/** The current collaboration config, if collaboration is already active. */
	activeCollaboration?: CollaborationConfig;
	/**
	 * Callback invoked when the user clicks "Start Sharing".
	 * Receives the configuration to start a collaboration session.
	 */
	onStartCollaboration?: (config: CollaborationConfig) => void;
	/**
	 * Callback invoked when the user clicks "Stop Sharing".
	 */
	onStopCollaboration?: () => void;
	/** When true, the session config fields are read-only (host app provides them). */
	preconfigured?: boolean;
	/** Default value for the room/session name field. */
	defaultRoomId?: string;
	/** Default value for the user display name field. */
	defaultUserName?: string;
	/** Default value for the collaboration server URL field. */
	defaultServerUrl?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareDialog({
	open,
	onClose,
	activeCollaboration,
	onStartCollaboration,
	onStopCollaboration,
	preconfigured,
	defaultRoomId,
	defaultUserName,
	defaultServerUrl,
}: ShareDialogProps): React.ReactElement | null {
	const collab = useCollaboration();
	const isActive = collab !== null && collab.status !== 'disconnected' && collab.status !== 'error';
	const { t } = useTranslation();

	// Form state for starting a new session — all defaults come from host app
	const [roomId, setRoomId] = useState(defaultRoomId ?? '');
	const [userName, setUserName] = useState(defaultUserName ?? '');
	const [serverUrl, setServerUrl] = useState(defaultServerUrl ?? '');
	const [copied, setCopied] = useState(false);
	const dialogRef = useRef<HTMLDivElement>(null);

	// Sync from active config if provided
	useEffect(() => {
		if (activeCollaboration) {
			setRoomId(activeCollaboration.roomId);
			setUserName(activeCollaboration.userName);
			setServerUrl(activeCollaboration.serverUrl);
		}
	}, [activeCollaboration]);

	// Close on Escape
	useEffect(() => {
		if (!open) {
			return;
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose();
			}
		}
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [open, onClose]);

	// Focus trap: focus dialog on open
	useEffect(() => {
		if (open && dialogRef.current) {
			dialogRef.current.focus();
		}
	}, [open]);

	const handleCopyRoomId = useCallback(() => {
		const config = activeCollaboration ?? { roomId, serverUrl };
		const shareUrl =
			typeof window !== 'undefined'
				? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(config.roomId)}&server=${encodeURIComponent(config.serverUrl)}`
				: config.roomId;
		void navigator.clipboard.writeText(shareUrl).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			return undefined;
		});
	}, [activeCollaboration, roomId, serverUrl]);

	const handleStartSharing = useCallback(() => {
		if (!roomId.trim() || !userName.trim()) {
			return;
		}
		onStartCollaboration?.({
			roomId: roomId.trim(),
			serverUrl: serverUrl.trim(),
			userName: userName.trim(),
		});
	}, [roomId, userName, serverUrl, onStartCollaboration]);

	const canStart =
		roomId.trim().length > 0 && userName.trim().length > 0 && serverUrl.trim().length > 0;

	if (!open) {
		return null;
	}

	return (
		<>
			{/* Backdrop */}
			<button
				type='button'
				style={{ zIndex: 1200 }}
				className='fixed inset-0 bg-black/50'
				aria-label={t('pptx.share.closeDialog')}
				onClick={onClose}
			/>

			{/* Dialog */}
			<div
				style={{ zIndex: 1201 }}
				className='fixed inset-0 flex items-center justify-center pointer-events-none'
			>
				<div
					ref={dialogRef}
					role='dialog'
					aria-modal='true'
					aria-label={t('pptx.share.title')}
					tabIndex={-1}
					className='pointer-events-auto w-full max-w-md rounded-xl border border-border bg-popover text-foreground shadow-2xl outline-none'
				>
					{/* Header */}
					<div className='flex items-center justify-between px-5 py-3 border-b border-border'>
						<h2 className='text-sm font-semibold text-foreground'>
							{isActive ? t('pptx.share.collaborationActive') : t('pptx.share.title')}
						</h2>
						<button
							type='button'
							onClick={onClose}
							className='text-muted-foreground hover:text-foreground text-lg leading-none'
							aria-label={t('pptx.share.close')}
						>
							&times;
						</button>
					</div>

					{/* Body */}
					<div className='px-5 py-4'>
						{isActive ? (
							<ActiveSessionView
								collab={collab}
								activeCollaboration={activeCollaboration}
								copied={copied}
								onCopyRoomId={handleCopyRoomId}
								onStopCollaboration={onStopCollaboration}
							/>
						) : (
							<StartSessionForm
								roomId={roomId}
								userName={userName}
								serverUrl={serverUrl}
								onRoomIdChange={setRoomId}
								onUserNameChange={setUserName}
								onServerUrlChange={setServerUrl}
								preconfigured={preconfigured}
							/>
						)}
					</div>

					{/* Footer */}
					<div className='flex justify-end gap-2 px-5 py-3 border-t border-border'>
						<button
							type='button'
							onClick={onClose}
							className='px-3 py-1.5 rounded bg-muted hover:bg-accent text-[12px] text-foreground transition-colors'
						>
							{isActive ? t('pptx.share.close') : t('pptx.share.cancel')}
						</button>
						{!isActive && (
							<button
								type='button'
								disabled={!canStart}
								onClick={handleStartSharing}
								className='px-3 py-1.5 rounded bg-primary hover:bg-primary/90 text-[12px] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
							>
								{t('pptx.share.startSharing')}
							</button>
						)}
					</div>
				</div>
			</div>
		</>
	);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Form for configuring a new collaboration session. */
function StartSessionForm({
	roomId,
	userName,
	serverUrl,
	onRoomIdChange,
	onUserNameChange,
	onServerUrlChange,
	preconfigured,
}: {
	roomId: string;
	userName: string;
	serverUrl: string;
	onRoomIdChange: (v: string) => void;
	onUserNameChange: (v: string) => void;
	onServerUrlChange: (v: string) => void;
	preconfigured?: boolean;
}) {
	const { t } = useTranslation();
	const inputReadOnlyClass = preconfigured ? ' opacity-70 cursor-not-allowed' : '';

	return (
		<div className='space-y-4'>
			<p className='text-[13px] text-muted-foreground leading-relaxed'>
				{preconfigured ? t('pptx.share.preconfiguredDescription') : t('pptx.share.description')}
			</p>

			{/* Room / Session Name */}
			<div className='space-y-1.5'>
				<label htmlFor='share-room-id' className='block text-[12px] font-medium text-foreground'>
					{t('pptx.share.sessionName')}
				</label>
				<input
					id='share-room-id'
					type='text'
					value={roomId}
					onChange={(e) => onRoomIdChange(e.target.value)}
					readOnly={preconfigured}
					placeholder={t('pptx.share.sessionPlaceholder')}
					className={`w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary${inputReadOnlyClass}`}
				/>
				<p className='text-[11px] text-muted-foreground'>{t('pptx.share.sessionHint')}</p>
			</div>

			{/* User Display Name */}
			<div className='space-y-1.5'>
				<label htmlFor='share-user-name' className='block text-[12px] font-medium text-foreground'>
					{t('pptx.share.displayName')}
				</label>
				<input
					id='share-user-name'
					type='text'
					value={userName}
					onChange={(e) => onUserNameChange(e.target.value)}
					readOnly={preconfigured}
					placeholder={t('pptx.share.namePlaceholder')}
					className={`w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary${inputReadOnlyClass}`}
				/>
			</div>

			{/* Server URL */}
			<div className='space-y-1.5'>
				<label htmlFor='share-server-url' className='block text-[12px] font-medium text-foreground'>
					{t('pptx.share.serverLabel')}
				</label>
				<input
					id='share-server-url'
					type='text'
					value={serverUrl}
					onChange={(e) => onServerUrlChange(e.target.value)}
					readOnly={preconfigured}
					placeholder={t('pptx.share.serverPlaceholder')}
					className={`w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary${inputReadOnlyClass}`}
				/>
			</div>

			{/* y-websocket server hint */}
			<p className='text-[11px] text-muted-foreground/70 leading-relaxed'>
				Run{' '}
				<code className='px-1 py-0.5 rounded bg-muted text-[10px] font-mono'>bun run collab</code>{' '}
				to start the server. Others can join at{' '}
				<code className='px-1 py-0.5 rounded bg-muted text-[10px] font-mono'>
					?room=SESSION_NAME
				</code>
			</p>
		</div>
	);
}

/** View shown when a collaboration session is active. */
function ActiveSessionView({
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
						{typeof window !== 'undefined'
							? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(collab.config.roomId)}&server=${encodeURIComponent(collab.config.serverUrl)}`
							: collab.config.roomId}
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
					<code className='font-mono text-foreground'>{collab.config.serverUrl}</code>
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
